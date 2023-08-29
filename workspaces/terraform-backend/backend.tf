terraform {
  backend "s3" {
    key            = "terraform-backend/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}