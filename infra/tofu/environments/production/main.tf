provider "google" {
  project = var.project_id
  region  = var.region
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

locals {
  prefix = "neuroloom-prod"

  instances = {
    "${local.prefix}-k3s-server-1" = {
      zone              = var.zone
      machine_type      = "e2-standard-4"
      boot_disk_size_gb = 100
      boot_disk_type    = "pd-balanced"
      boot_image        = "projects/debian-cloud/global/images/family/debian-12"
      tags              = ["neuroloom-ingress", "neuroloom-app"]
      assign_public_ip  = true
      metadata = {
        role = "k3s-server"
      }
    }
    "${local.prefix}-k3s-agent-1" = {
      zone              = var.zone
      machine_type      = "e2-standard-4"
      boot_disk_size_gb = 100
      boot_disk_type    = "pd-balanced"
      boot_image        = "projects/debian-cloud/global/images/family/debian-12"
      tags              = ["neuroloom-app"]
      assign_public_ip  = false
      metadata = {
        role = "k3s-agent"
      }
    }
    "${local.prefix}-k3s-agent-2" = {
      zone              = var.zone
      machine_type      = "e2-standard-4"
      boot_disk_size_gb = 100
      boot_disk_type    = "pd-balanced"
      boot_image        = "projects/debian-cloud/global/images/family/debian-12"
      tags              = ["neuroloom-app"]
      assign_public_ip  = false
      metadata = {
        role = "k3s-agent"
      }
    }
    "${local.prefix}-data-1" = {
      zone              = var.zone
      machine_type      = "e2-standard-4"
      boot_disk_size_gb = 300
      boot_disk_type    = "pd-balanced"
      boot_image        = "projects/debian-cloud/global/images/family/debian-12"
      tags              = ["neuroloom-data"]
      assign_public_ip  = false
      metadata = {
        role = "data-primary"
      }
    }
    "${local.prefix}-data-2" = {
      zone              = var.zone
      machine_type      = "e2-standard-4"
      boot_disk_size_gb = 300
      boot_disk_type    = "pd-balanced"
      boot_image        = "projects/debian-cloud/global/images/family/debian-12"
      tags              = ["neuroloom-data"]
      assign_public_ip  = false
      metadata = {
        role = "data-replica"
      }
    }
  }
}

module "network" {
  source                = "../../modules/gcp-network"
  name                  = local.prefix
  project_id            = var.project_id
  region                = var.region
  subnet_cidr           = var.subnet_cidr
  ssh_source_ranges     = var.ssh_source_ranges
  ingress_source_ranges = var.ingress_source_ranges
  ingress_target_tags   = ["neuroloom-ingress"]
}

module "nodes" {
  source           = "../../modules/gcp-nodes"
  project_id       = var.project_id
  region           = var.region
  subnet_self_link = module.network.subnet_self_link
  instances        = local.instances
}

module "cloudflare_dns" {
  source             = "../../modules/cloudflare-dns"
  zone_id            = var.cloudflare_zone_id
  app_hostname       = "app.${var.root_domain}"
  api_hostname       = "api.${var.root_domain}"
  files_hostname     = "files.${var.root_domain}"
  app_origin_ipv4    = module.nodes.public_ips["${local.prefix}-k3s-server-1"]
  api_origin_ipv4    = module.nodes.public_ips["${local.prefix}-k3s-server-1"]
  files_cname_target = var.files_cname_target
}
