variable "name" {
  type = string
}

variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "subnet_cidr" {
  type = string
}

variable "ssh_source_ranges" {
  type    = list(string)
  default = []
}

variable "ingress_source_ranges" {
  type    = list(string)
  default = []
}

variable "ingress_target_tags" {
  type    = list(string)
  default = []
}
