variable "name" {
  type = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,62}$", var.name))
    error_message = "name must be a lowercase infrastructure name between 3 and 63 characters."
  }
}

variable "project_id" {
  type = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "project_id must be a valid GCP project id."
  }
}

variable "region" {
  type = string

  validation {
    condition     = can(regex("^[a-z]+-[a-z0-9]+[0-9]$", var.region))
    error_message = "region must be a valid GCP region name."
  }
}

variable "subnet_cidr" {
  type = string

  validation {
    condition     = can(cidrhost(var.subnet_cidr, 0))
    error_message = "subnet_cidr must be a valid CIDR block."
  }
}

variable "internal_tcp_ports" {
  type = list(string)
  default = [
    "2379-2380",
    "5432",
    "6379",
    "6443",
    "9000-9001",
    "10250",
  ]

  validation {
    condition     = length(var.internal_tcp_ports) > 0 && alltrue([for port in var.internal_tcp_ports : can(regex("^[0-9]+(-[0-9]+)?$", port))])
    error_message = "internal_tcp_ports must contain explicit ports or port ranges."
  }
}

variable "internal_udp_ports" {
  type    = list(string)
  default = ["8472"]

  validation {
    condition     = length(var.internal_udp_ports) > 0 && alltrue([for port in var.internal_udp_ports : can(regex("^[0-9]+(-[0-9]+)?$", port))])
    error_message = "internal_udp_ports must contain explicit ports or port ranges."
  }
}

variable "internal_target_tags" {
  type    = list(string)
  default = ["neuroloom-app", "neuroloom-data", "neuroloom-ingress"]

  validation {
    condition     = length(var.internal_target_tags) > 0 && alltrue([for tag in var.internal_target_tags : length(trimspace(tag)) > 0])
    error_message = "internal_target_tags must contain at least one non-empty network tag."
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

variable "ssh_target_tags" {
  type    = list(string)
  default = ["neuroloom-ingress"]

  validation {
    condition     = length(var.ssh_target_tags) > 0 && alltrue([for tag in var.ssh_target_tags : length(trimspace(tag)) > 0])
    error_message = "ssh_target_tags must contain at least one non-empty network tag."
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

variable "ingress_target_tags" {
  type    = list(string)
  default = []

  validation {
    condition     = alltrue([for tag in var.ingress_target_tags : length(trimspace(tag)) > 0])
    error_message = "ingress_target_tags cannot contain blank tags."
  }
}
