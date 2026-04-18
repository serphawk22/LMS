terraform {
  required_version = ">= 1.5.0"
}

provider "aws" {
  region = var.aws_region
}

provider "postgresql" {
  host     = var.postgres_host
  port     = var.postgres_port
  username = var.postgres_user
  password = var.postgres_password
  database = var.postgres_db
}

resource "aws_s3_bucket" "lms_assets" {
  bucket = var.s3_bucket_name
  acl    = "private"
}
