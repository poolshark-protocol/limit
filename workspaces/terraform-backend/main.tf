provider "aws" {
  region = "us-east-1"
  profile = var.env
}

resource "aws_s3_bucket" "terraform-backend" {
  bucket = var.terraform_bucket_name  
  # versioning will track the full history of the tfstate
  versioning {
    enabled = false
  }
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
}

resource "aws_s3_bucket" "artifacts"{
  bucket = var.artifacts_bucket_name
  # versioning will track the full history of the tfstate
  versioning {
    enabled = false
  }
  server_side_encryption_configuration {
    rule {
      apply_server_side_encryption_by_default {
        sse_algorithm = "AES256"
      }
    }
  }
}

data "aws_iam_policy_document" "artifacts" {
  statement {
    sid       = "AllowEC2"
    effect    = "Allow"
    actions   = ["s3:GetObject","s3:ListBucket"]
    resources = ["arn:aws:s3:::${var.artifacts_bucket_name}", "arn:aws:s3:::${var.artifacts_bucket_name}/db/*"]

    principals {
      type        = "AWS"
      identifiers = ["${data.aws_iam_role.payouts.arn}"]
    }
  }
}

resource "aws_dynamodb_table" "terraform_locks" {
  name         = "terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"  

  attribute {
    name = "LockID"
    type = "S"
  }
}