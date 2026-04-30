variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "s3_bucket_name" {
  type = string
}

variable "postgres_host" {
  type = string
}

variable "postgres_port" {
  type    = number
  default = 5432
}

variable "postgres_user" {
  type = string
}

variable "postgres_password" {
  type = string
  sensitive = true
}

variable "postgres_db" {
  type = string
  default = "lms"
}
