variable "zone_id" {
  type = string

  validation {
    condition     = can(regex("^[0-9a-fA-F]{32}$", var.zone_id))
    error_message = "zone_id must be a 32-character Cloudflare zone id."
  }
}

variable "app_hostname" {
  type = string

  validation {
    condition = (
      length(var.app_hostname) <= 253 &&
      length(split(".", var.app_hostname)) >= 2 &&
      alltrue([
        for label in split(".", var.app_hostname) :
        can(regex("^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$", label))
      ])
    )
    error_message = "app_hostname must be a valid DNS hostname."
  }
}

variable "api_hostname" {
  type = string

  validation {
    condition = (
      length(var.api_hostname) <= 253 &&
      length(split(".", var.api_hostname)) >= 2 &&
      alltrue([
        for label in split(".", var.api_hostname) :
        can(regex("^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$", label))
      ])
    )
    error_message = "api_hostname must be a valid DNS hostname."
  }
}

variable "files_hostname" {
  type = string

  validation {
    condition = (
      length(var.files_hostname) <= 253 &&
      length(split(".", var.files_hostname)) >= 2 &&
      alltrue([
        for label in split(".", var.files_hostname) :
        can(regex("^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$", label))
      ])
    )
    error_message = "files_hostname must be a valid DNS hostname."
  }
}

variable "app_origin_ipv4" {
  type = string

  validation {
    condition     = length(split(".", var.app_origin_ipv4)) == 4 && can(cidrhost("${var.app_origin_ipv4}/32", 0))
    error_message = "app_origin_ipv4 must be a valid IPv4 address."
  }
}

variable "api_origin_ipv4" {
  type = string

  validation {
    condition     = length(split(".", var.api_origin_ipv4)) == 4 && can(cidrhost("${var.api_origin_ipv4}/32", 0))
    error_message = "api_origin_ipv4 must be a valid IPv4 address."
  }
}

variable "files_cname_target" {
  type = string

  validation {
    condition = (
      length(var.files_cname_target) <= 253 &&
      length(split(".", var.files_cname_target)) >= 2 &&
      alltrue([
        for label in split(".", var.files_cname_target) :
        can(regex("^[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$", label))
      ])
    )
    error_message = "files_cname_target must be a valid DNS hostname."
  }
}

variable "proxied" {
  type    = bool
  default = true
}

variable "unproxied_ttl" {
  type    = number
  default = 300

  validation {
    condition     = var.unproxied_ttl >= 60 && var.unproxied_ttl <= 86400
    error_message = "unproxied_ttl must be between 60 and 86400 seconds."
  }
}
