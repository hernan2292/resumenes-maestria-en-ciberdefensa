package crypto

import "net"

// TruncateIP aplica minimización de datos (adenda punto 7): pone a cero el
// último octeto en IPv4 o los últimos 80 bits en IPv6, suficiente para
// analítica de abuso/geolocalización gruesa sin identificar unívocamente al
// dispositivo del profesional o paciente en el log de auditoría "inmutable".
func TruncateIP(ipStr string) string {
	ip := net.ParseIP(ipStr)
	if ip == nil {
		return "0.0.0.0"
	}
	if v4 := ip.To4(); v4 != nil {
		v4[3] = 0
		return v4.String()
	}
	v6 := ip.To16()
	if v6 == nil {
		return "::"
	}
	for i := 6; i < 16; i++ {
		v6[i] = 0
	}
	return v6.String()
}
