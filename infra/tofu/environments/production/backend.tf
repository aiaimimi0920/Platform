terraform {
  backend "gcs" {
    prefix = "platform/production"
  }
}
