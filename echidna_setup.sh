yum install git
git clone -b echidna https://github.com/poolshark-protocol/limit.git
curl -fL https://github.com/crytic/echidna/releases/download/v2.2.1/echidna-2.2.1-Linux.zip -o echidna.zip
unzip echidna.zip
tar xvf echidna.tar.gz
echidna contracts/EchidnaPool.sol --config contracts/test/echidna/config.yaml