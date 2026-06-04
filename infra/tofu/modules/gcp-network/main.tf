resource "google_compute_network" "this" {
  name                    = var.name
  project                 = var.project_id
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "this" {
  name          = "${var.name}-${var.region}"
  project       = var.project_id
  region        = var.region
  network       = google_compute_network.this.id
  ip_cidr_range = var.subnet_cidr
}

resource "google_compute_firewall" "internal" {
  name    = "${var.name}-internal"
  project = var.project_id
  network = google_compute_network.this.name

  source_ranges = [var.subnet_cidr]

  allow {
    protocol = "tcp"
  }

  allow {
    protocol = "udp"
  }

  allow {
    protocol = "icmp"
  }
}

resource "google_compute_firewall" "ssh" {
  count   = length(var.ssh_source_ranges) > 0 ? 1 : 0
  name    = "${var.name}-ssh"
  project = var.project_id
  network = google_compute_network.this.name

  source_ranges = var.ssh_source_ranges

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
}

resource "google_compute_firewall" "ingress" {
  count   = length(var.ingress_source_ranges) > 0 && length(var.ingress_target_tags) > 0 ? 1 : 0
  name    = "${var.name}-ingress"
  project = var.project_id
  network = google_compute_network.this.name

  source_ranges = var.ingress_source_ranges
  target_tags   = var.ingress_target_tags

  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
}
