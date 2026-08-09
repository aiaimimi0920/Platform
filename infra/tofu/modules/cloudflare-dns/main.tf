resource "cloudflare_dns_record" "app" {
  zone_id = var.zone_id
  name    = var.app_hostname
  type    = "A"
  content = var.app_origin_ipv4
  proxied = var.proxied
  ttl     = var.proxied ? 1 : var.unproxied_ttl
}

resource "cloudflare_dns_record" "api" {
  zone_id = var.zone_id
  name    = var.api_hostname
  type    = "A"
  content = var.api_origin_ipv4
  proxied = var.proxied
  ttl     = var.proxied ? 1 : var.unproxied_ttl
}

resource "cloudflare_dns_record" "files" {
  zone_id = var.zone_id
  name    = var.files_hostname
  type    = "CNAME"
  content = var.files_cname_target
  proxied = var.proxied
  ttl     = var.proxied ? 1 : var.unproxied_ttl
}
