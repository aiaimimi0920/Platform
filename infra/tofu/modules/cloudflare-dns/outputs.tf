output "hostnames" {
  value = {
    app   = var.app_hostname
    api   = var.api_hostname
    files = var.files_hostname
  }
}

output "record_ids" {
  value = {
    app   = cloudflare_dns_record.app.id
    api   = cloudflare_dns_record.api.id
    files = cloudflare_dns_record.files.id
  }
}

output "targets" {
  value = {
    app   = var.app_origin_ipv4
    api   = var.api_origin_ipv4
    files = var.files_cname_target
  }
}

output "proxied" {
  value = var.proxied
}
