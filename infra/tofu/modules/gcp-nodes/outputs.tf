output "private_ips" {
  value = {
    for key, instance in google_compute_instance.this : key => instance.network_interface[0].network_ip
  }
}

output "public_ips" {
  value = {
    for key, address in google_compute_address.public_ipv4 : key => address.address
  }
}

output "data_disk_ids" {
  value = {
    for key, disk in google_compute_disk.data : key => disk.id
  }
}

output "node_service_account_email" {
  value = google_service_account.nodes.email
}
