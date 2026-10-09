#!/bin/sh
# Включает развилку на порту 443 для https://espiresgroup.ru (сайт Анкарии без Cloudflare).
#
# Как это работает: новые подключения на 443 правило iptables заворачивает в HAProxy (порт 10443).
# HAProxy смотрит имя сайта: espiresgroup.ru -> Caddy (сайт), всё остальное -> Xray (VPN), как раньше.
# Панель 3x-ui, ссылки и подписки VPN не меняются. Уже открытые подключения VPN не рвутся.
#
# Страховка: через 10 минут сервер САМ откатится, если не отменить таймер командой
#   systemctl stop sni-autorollback.timer && systemctl enable sni-redirect.service
# Ручной откат в любой момент:   /root/sni-rollback.sh
#
# Запуск с компьютера (SSH работает и без VPN):
#   scp deploy/espiresgroup-switch.sh root@78.17.36.77:/root/
#   ssh root@78.17.36.77 sh /root/espiresgroup-switch.sh
set -e
IP=78.17.36.77

# 1. скрипт отката
cat > /root/sni-rollback.sh <<'EOF'
#!/bin/sh
# Откат развилки на 443: весь порт 443 снова идёт напрямую в Xray (VPN).
systemctl stop sni-autorollback.timer 2>/dev/null
systemctl disable --now sni-redirect.service 2>/dev/null
while iptables -t nat -D PREROUTING -d 78.17.36.77 -p tcp --dport 443 -j REDIRECT --to-ports 10443 2>/dev/null; do :; done
echo "Откат сделан: порт 443 снова напрямую у VPN (Xray)."
EOF
chmod +x /root/sni-rollback.sh

# 2. служба, которая ставит правило (после проверки её включают, чтобы пережила перезагрузку)
cat > /etc/systemd/system/sni-redirect.service <<EOF
# Анкария: порт 443 -> HAProxy (развилка по имени сайта). Откат: /root/sni-rollback.sh
[Unit]
Description=Anacaria: port 443 -> HAProxy SNI router
After=network-online.target haproxy.service
Wants=haproxy.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/sh -c "iptables -t nat -C PREROUTING -d $IP -p tcp --dport 443 -j REDIRECT --to-ports 10443 2>/dev/null || iptables -t nat -I PREROUTING -d $IP -p tcp --dport 443 -j REDIRECT --to-ports 10443"
ExecStop=/bin/sh -c "while iptables -t nat -D PREROUTING -d $IP -p tcp --dport 443 -j REDIRECT --to-ports 10443 2>/dev/null; do :; done"

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload

# 3. проверки перед переключением: адрес на сетевой карте, HAProxy жив и доводит до Xray
ip -4 addr | grep -q "inet $IP/" || { echo "СТОП: адрес $IP не висит на сетевой карте — переключение не сработает, ничего не меняю"; exit 1; }
systemctl is-active --quiet haproxy || { echo "СТОП: HAProxy не запущен — ничего не меняю"; exit 1; }
curl -sk -o /dev/null --max-time 8 --resolve kuptam.pl:10443:127.0.0.1 https://kuptam.pl:10443/ || { echo "СТОП: через HAProxy VPN не отвечает — ничего не меняю"; exit 1; }

# 4. страховка: автооткат через 10 минут
systemctl stop sni-autorollback.timer 2>/dev/null || true
systemd-run --quiet --unit=sni-autorollback --on-active=10min /root/sni-rollback.sh

# 5. переключение
systemctl start sni-redirect.service
echo "Включено. Переподключи VPN и проверь, что он работает."
echo "Если всё хорошо, в течение 10 минут выполни:"
echo "  ssh root@$IP \"systemctl stop sni-autorollback.timer && systemctl enable sni-redirect.service\""
echo "Если ничего не делать, через 10 минут всё само вернётся как было."
