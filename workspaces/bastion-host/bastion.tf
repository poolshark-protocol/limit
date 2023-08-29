
######### RESOURCES ##########

resource "aws_key_pair" "bastion" {
  key_name   = "bastion-key"
  public_key = var.bastion_pubkey
}
/*
resource "aws_security_group" "bastion-to-rds"{
  # allow outbound connection to DB
  # Do we have to use master user?
  name         = "bastion_to_rds"
  description  = "Allow outbound connection to mysql on RDS"
  vpc_id       = data.aws_vpc.main.id

  egress {
    from_port       = var.db_port
    to_port         = var.db_port
    protocol        = "tcp"
    security_groups = ["${data.aws_security_group.database_sg.id}"]
  }
}*/

module "bastion" {
  source = "../../modules/terraform-aws-bastion/"
  allow_ssh_commands = "True"
  bucket_name = var.bastion_logs_bucket_name
  region = "us-east-1"
  vpc_id = data.aws_vpc.main.id
  is_lb_private = "false"
  bastion_host_key_pair = "${aws_key_pair.bastion.key_name}"
  create_dns_record = "true"
  hosted_zone_id = data.aws_route53_zone.env.id
  bastion_record_name = "bastion.${data.aws_route53_zone.env.name}"
  bastion_iam_policy_name = "BastionHostPolicy"
  elb_subnets = [
    data.aws_subnet.admin_1c.id
  ]
  auto_scaling_group_subnets = [
    data.aws_subnet.admin_1c.id
  ]
  tags = {
    "name" = "Echidna Bastion",
    "description" = "host to access private subnet"
  }
}
