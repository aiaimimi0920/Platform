output "app_record_id" {
  value = cloudflare_dns_record.app.id
}

output "api_record_id" {
  value = cloudflare_dns_record.api.id
}

output "files_record_id" {
  value = cloudflare_dns_record.files.id
}
