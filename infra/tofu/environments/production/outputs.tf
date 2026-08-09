output "environment" {
  value = local.environment
}

output "network_self_link" {
  value = module.network.network_self_link
}

output "subnet_self_link" {
  value = module.network.subnet_self_link
}

output "control_plane_public_ipv4" {
  value = module.nodes.public_ips[local.control_plane_node_name]
}

output "control_plane_private_ipv4" {
  value = module.nodes.private_ips[local.control_plane_node_name]
}

output "node_private_ips" {
  value = module.nodes.private_ips
}

output "node_public_ips" {
  value = module.nodes.public_ips
}

output "data_disk_ids" {
  value = module.nodes.data_disk_ids
}

output "node_service_account_email" {
  value = module.nodes.node_service_account_email
}

output "dns_hostnames" {
  value = module.cloudflare_dns.hostnames
}

output "dns_record_ids" {
  value = module.cloudflare_dns.record_ids
}

output "dns_targets" {
  value = module.cloudflare_dns.targets
}
