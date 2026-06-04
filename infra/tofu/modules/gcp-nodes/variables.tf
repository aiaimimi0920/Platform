variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "subnet_self_link" {
  type = string
}

variable "instances" {
  type = map(object({
    zone              = string
    machine_type      = string
    boot_disk_size_gb = number
    boot_disk_type    = string
    boot_image        = string
    tags              = list(string)
    assign_public_ip  = bool
    metadata          = map(string)
  }))
}
