terraform {
  backend "gcs" {
    prefix = "platform/staging"
  }
}
