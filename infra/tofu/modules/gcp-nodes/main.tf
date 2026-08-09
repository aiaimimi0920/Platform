resource "google_service_account" "nodes" {
  account_id   = substr("${var.name}-nodes", 0, 30)
  display_name = "${var.name} nodes"
  project      = var.project_id
}

resource "google_project_iam_member" "nodes" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.nodes.email}"
}

resource "google_compute_address" "public_ipv4" {
  for_each = {
    for key, instance in var.instances : key => instance
    if instance.assign_public_ip
  }

  name    = "${each.key}-ipv4"
  project = var.project_id
  region  = var.region
}

resource "google_compute_disk" "data" {
  for_each = {
    for key, instance in var.instances : key => instance
    if instance.data_disk_size_gb > 0
  }

  name    = "${each.key}-data"
  project = var.project_id
  zone    = each.value.zone
  type    = each.value.data_disk_type
  size    = each.value.data_disk_size_gb
}

resource "google_compute_instance" "this" {
  for_each = var.instances

  name         = each.key
  project      = var.project_id
  zone         = each.value.zone
  machine_type = each.value.machine_type
  tags         = each.value.tags
  metadata = {
    "block-project-ssh-keys" = "TRUE"
    "enable-oslogin"         = "TRUE"
    "platform-role"          = each.value.role
  }

  boot_disk {
    auto_delete = true

    initialize_params {
      image = each.value.boot_image
      size  = each.value.boot_disk_size_gb
      type  = each.value.boot_disk_type
    }
  }

  dynamic "attached_disk" {
    for_each = each.value.data_disk_size_gb > 0 ? [google_compute_disk.data[each.key].self_link] : []

    content {
      source      = attached_disk.value
      device_name = "platform-data"
      mode        = "READ_WRITE"
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

  service_account {
    email = google_service_account.nodes.email
    scopes = [
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring.write",
    ]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_secure_boot          = true
    enable_vtpm                 = true
  }

  lifecycle {
    precondition {
      condition     = startswith(each.value.zone, "${var.region}-")
      error_message = "Every instance zone must belong to the configured region."
    }

  }
}
