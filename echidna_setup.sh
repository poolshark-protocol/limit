# ssh -i ~/Downloads/alpha-key.pem ec2-user@18.212.239.218 // RUNNING
# ssh -i ~/Downloads/alpha-key.pem ec2-user@3.90.33.225 // RUNNING
# ssh -i ~/Downloads/alpha-key.pem ec2-user@54.152.13.15 // RUNNING
# stop all machines at 5pm and save corpuses
# restart all machines w/ updated corpus
yum install git -y
yum install python3-pip
pip3 install crytic-compile
pip3 install slither-analyzer --user
mkdir ~/git
cd ~/git
git clone -b echidna https://github.com/poolshark-protocol/limit.git
# curl -fL https://github.com/crytic/echidna/releases/download/v2.2.1/echidna-2.2.1-Linux.zip -o echidna.zip
# unzip echidna.zip
# tar xvf echidna.tar.gz
solc-select install 0.8.13
solc-select use 0.8.13
cd ~/git/limit
nohup ./echidna contracts/LimitEchidnaPool.sol --config contracts/test/echidna/config.yaml --corpus-dir corpus --workers 128 &
top -o %MEM -c
tail -f ~/git/limit/nohup.out -n 100

# running a single reproducer file
# 1. mkdir -p corpus-new/reproducers
# 2. cp corpus/reproducers/xxx.txt
# 3. nohup ./echidna contracts/EchidnaPool.sol --config contracts/test/echidna/config.yaml --corpus-dir corpus-new --workers 128 &