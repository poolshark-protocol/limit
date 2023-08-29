
variable "terraform_bucket_name"{
	description = "S3 bucket name for Terraform state"
	type        = string
}

variable "artifacts_bucket_name" {
	description = "S3 bucket name for artifacts"
	type        = string
}

variable "env" {
	description = "dev OR prod"
	type        = string
}