output "s3_bucket_name" {
  value = aws_s3_bucket.lms_assets.bucket
}

output "postgresql_connection_string" {
  value = "postgresql://${var.postgres_user}:${var.postgres_password}@${var.postgres_host}:${var.postgres_port}/${var.postgres_db}"
  sensitive = true
}
