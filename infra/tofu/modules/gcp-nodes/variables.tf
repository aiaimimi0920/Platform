variable "name" {
  type = string

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,24}$", var.name))
    error_message = "name must be a lowercase environment prefix between 3 and 25 characters."
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

variable "subnet_self_link" {
  type = string

  validation {
    condition     = length(trimspace(var.subnet_self_link)) > 0
    error_message = "subnet_self_link is required."
  }
}

variable "instances" {
  type = map(object({
    zone              = string
    machine_type      = string
    boot_disk_size_gb = number
    boot_disk_type    = string
    boot_image        = string
    data_disk_size_gb = number
    data_disk_type    = string
    tags              = list(string)
    assign_public_ip  = bool
    role              = string
  }))

  validation {
    condition = length(var.instances) > 0 && alltrue([
      for instance in values(var.instances) :
      instance.boot_disk_size_gb >= 20 &&
      instance.data_disk_size_gb >= 0 &&
      length(trimspace(instance.boot_disk_type)) > 0 &&
      length(trimspace(instance.data_disk_type)) > 0 &&
      length(trimspace(instance.boot_image)) > 0 &&
      contains(["k3s-server", "k3s-agent", "data-primary", "data-replica"], instance.role)
    ])
    error_message = "instances must define valid boot disks, persistent data disks, and approved Platform roles."
  }
}
