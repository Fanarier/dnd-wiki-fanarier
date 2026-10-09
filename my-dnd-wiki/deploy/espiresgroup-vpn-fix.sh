#!/bin/sh
# Дополнение к espiresgroup-switch.sh: развилка на 443 и для подключений, которые рождаются на самом сервере.
#
# Зачем: кто открывает espiresgroup.ru через этот же VPN, у того запрос к сайту выходит из Xray на самом
# сервере. Такие пакеты идут через цепочку OUTPUT, а не PREROUTING, развилку минуют и попадают прямо в Xray,
# а тот отправляет чужих на маску kuptam.pl. Добавляем то же правило в OUTPUT.
# Петли нет: HAProxy ходит в Xray по 127.0.0.1:443, а правило ловит только адрес 78.17.36.77.
#
# Порядок: ставим правило -> проверяем сайт и VPN -> только если оба живы, сохраняем в службу.
# Если проверка не прошла, правило сразу убирается и всё остаётся как было.
#
# Запуск с компьютера:
#   scp deploy/espiresgroup-vpn-fix.sh root@78.17.36.77:/root/
#   ssh root@78.17.36.77 sh /root/espiresgroup-vpn-fix.sh
RULE="-d 78.17.36.77 -p tcp --dport 443 -j REDIRECT --to-ports 10443"

# 1. правило в OUTPUT (пока только в памяти, до перезагрузки)
iptables -t nat -C OUTPUT $RULE 2>/dev/null || iptables -t nat -I OUTPUT $RULE

# 2. проверка: сайт с самого сервера (как у тех, кто через VPN) и маска VPN — обе дороги должны жить
S=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 --resolve espiresgroup.ru:443:78.17.36.77 https://espiresgroup.ru/)
V=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 --resolve kuptam.pl:443:78.17.36.77 https://kuptam.pl/)
echo "сайт через VPN: $S (нужно 200), маска VPN: $V (нужно 200)"
if [ "$S" != "200" ] || [ "$V" != "200" ]; then
  while iptables -t nat -D OUTPUT $RULE 2>/dev/null; do :; done
  echo "СТОП: проверка не прошла — новое правило убрал, всё как было."
  exit 1
fi

# 3. сохраняем: служба ставит правило в обе цепочки ($$ — чтобы systemd не подставлял переменную сам)
cat > /etc/systemd/system/sni-redirect.service <<'EOF'
# Анкария: порт 443 -> HAProxy (развилка по имени сайта), и снаружи, и с самого сервера. Откат: /root/sni-rollback.sh
[Unit]
Description=Anacaria: port 443 -> HAProxy SNI router
After=network-online.target haproxy.service
Wants=haproxy.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/sh -c 'for c in PREROUTING OUTPUT; do iptables -t nat -C $$c -d 78.17.36.77 -p tcp --dport 443 -j REDIRECT --to-ports 10443 2>/dev/null || iptables -t nat -I $$c -d 78.17.36.77 -p tcp --dport 443 -j REDIRECT --to-ports 10443; done'
ExecStop=/bin/sh -c 'for c in PREROUTING OUTPUT; do while iptables -t nat -D $$c -d 78.17.36.77 -p tcp --dport 443 -j REDIRECT --to-ports 10443 2>/dev/null; do :; done; done'

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload

# откат теперь убирает оба правила
cat > /root/sni-rollback.sh <<'EOF'
#!/bin/sh
# Откат развилки на 443: весь порт 443 снова идёт напрямую в Xray (VPN).
systemctl stop sni-autorollback.timer 2>/dev/null
systemctl disable --now sni-redirect.service 2>/dev/null
for c in PREROUTING OUTPUT; do
  while iptables -t nat -D $c -d 78.17.36.77 -p tcp --dport 443 -j REDIRECT --to-ports 10443 2>/dev/null; do :; done
done
echo "Откат сделан: порт 443 снова напрямую у VPN (Xray)."
EOF
chmod +x /root/sni-rollback.sh

echo "Готово: сайт открывается и через VPN, правило переживёт перезагрузку."
