terraform {
  backend "s3" {
    key            = "farmer-bastion/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}