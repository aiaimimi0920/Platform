variable "zone_id" {
  type = string
}

variable "app_hostname" {
  type = string
}

variable "api_hostname" {
  type = string
}

variable "files_hostname" {
  type = string
}

variable "app_origin_ipv4" {
  type = string
}

variable "api_origin_ipv4" {
  type = string
}

variable "files_cname_target" {
  type = string
}

variable "proxied" {
  type    = bool
  default = true
}
