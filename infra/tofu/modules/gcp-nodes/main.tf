resource "google_compute_address" "public_ipv4" {
  for_each = {
    for key, instance in var.instances : key => instance
    if instance.assign_public_ip
  }

  name    = "${each.key}-ipv4"
  project = var.project_id
  region  = var.region
}

resource "google_compute_instance" "this" {
  for_each = var.instances

  name         = each.key
  project      = var.project_id
  zone         = each.value.zone
  machine_type = each.value.machine_type
  tags         = each.value.tags
  metadata     = each.value.metadata

  boot_disk {
    initialize_params {
      image = each.value.boot_image
      size  = each.value.boot_disk_size_gb
      type  = each.value.boot_disk_type
    }
  }

  network_interface {
    subnetwork = var.subnet_self_link

    dynamic "access_config" {
      for_each = each.value.assign_public_ip ? [1] : []
      content {
        nat_ip = google_compute_address.public_ipv4[each.key].address
      }
    }
  }
}
