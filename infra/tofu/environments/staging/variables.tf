variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "asia-southeast1"
}

variable "zone" {
  type    = string
  default = "asia-southeast1-a"
}

variable "subnet_cidr" {
  type    = string
  default = "10.42.0.0/20"
}

variable "ssh_source_ranges" {
  type    = list(string)
  default = []
}

variable "ingress_source_ranges" {
  type    = list(string)
  default = []
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_zone_id" {
  type = string
}

variable "root_domain" {
  type = string
}

variable "files_cname_target" {
  type = string
}
