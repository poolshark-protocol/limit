###### DATA SOURCES #####

data "aws_subnet" "private_1b"{
  filter {
    name   = "tag:Name"
    values = ["Private 1b"]
  }
}

data "aws_vpc" "main" {
	id = var.vpc_id
}

data "aws_ami" "ubuntu" {
  most_recent = true

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  owners = ["099720109477"] # Canonical
}

data "aws_route53_zone" "main" {
  name = "${var.env}.poolshark.fi"
}