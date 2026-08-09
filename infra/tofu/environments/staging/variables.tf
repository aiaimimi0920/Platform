variable "project_id" {
  type = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id)) && !startswith(var.project_id, "replace-with-")
    error_message = "project_id must be a real GCP project id, not a placeholder."
  }
}

variable "region" {
  type    = string
  default = "asia-southeast1"

  validation {
    condition     = can(regex("^[a-z]+-[a-z0-9]+[0-9]$", var.region))
    error_message = "region must be a valid GCP region name."
  }
}

variable "zone" {
  type    = string
  default = "asia-southeast1-a"

  validation {
    condition     = can(regex("^[a-z]+-[a-z0-9]+[0-9]-[a-z]$", var.zone))
    error_message = "zone must be a valid GCP zone name."
  }
}

variable "subnet_cidr" {
  type    = string
  default = "10.42.0.0/20"

  validation {
    condition     = can(cidrhost(var.subnet_cidr, 0))
    error_message = "subnet_cidr must be a valid CIDR block."
  }
}

variable "ssh_source_ranges" {
  type    = list(string)
  default = []

  validation {
    condition = alltrue([
      for cidr in var.ssh_source_ranges :
      can(cidrhost(cidr, 0)) && cidr != "0.0.0.0/0" && cidr != "::/0"
    ])
    error_message = "ssh_source_ranges must contain valid restricted CIDRs; world-open ranges are forbidden."
  }
}

variable "ingress_source_ranges" {
  type    = list(string)
  default = []

  validation {
    condition = alltrue([
      for cidr in var.ingress_source_ranges :
      can(cidrhost(cidr, 0)) && cidr != "0.0.0.0/0" && cidr != "::/0"
    ])
    error_message = "ingress_source_ranges must contain valid restricted CIDRs; world-open ranges are forbidden."
  }
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true

  validation {
    condition     = length(trimspace(var.cloudflare_api_token)) >= 20 && !startswith(var.cloudflare_api_token, "replace-with-")
    error_message = "cloudflare_api_token must be supplied through a secure runtime channel."
  }
}

variable "cloudflare_zone_id" {
  type = string

  validation {
    condition     = can(regex("^[0-9a-fA-F]{32}$", var.cloudflare_zone_id))
    error_message = "cloudflare_zone_id must be a 32-character Cloudflare zone id."
  }
}

variable "root_domain" {
  type = string

  validation {
    condition = (
      length(var.root_domain) <= 253 &&
      length(split(".", var.root_domain)) >= 2 &&
      var.root_domain != "example.com" &&
      alltrue([
        for label in split(".", var.root_domain) :
        can(regex("^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$", label))
      ])
    )
    error_message = "root_domain must be a real DNS domain, not example.com."
  }
}

variable "files_cname_target" {
  type = string

  validation {
    condition = (
      length(var.files_cname_target) <= 253 &&
      length(split(".", var.files_cname_target)) >= 2 &&
      !strcontains(var.files_cname_target, "xxxxxxxx") &&
      alltrue([
        for label in split(".", var.files_cname_target) :
        can(regex("^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$", label))
      ])
    )
    error_message = "files_cname_target must be a real DNS hostname, not a placeholder."
  }
}
