const md5 = require('md5');
const erc20ABI = require('../abi/ERC20.json');
const ganache = require("ganache-cli");

class MessageProcessor {

    constructor(config, settings, web3, kId){
        this.config = config;
        this.settings = settings;
        this.web3 = web3;
        this.kId = kId;
    }


    _reply(text, message){
        if(message.sig !== undefined){
            this.web3.shh.post({ 
                pubKey: message.sig, 
                sig: this.kId,
                ttl: this.config.node.whisper.ttl, 
                powTarget:this.config.node.whisper.minPow, 
                powTime: this.config.node.whisper.powTime, 
                topic: message.topic, 
                payload: this.web3.utils.fromAscii(text)
            }).catch(console.error);
        }
    }


    async _validateInput(message, input){
        const contract = this.settings.getContractByTopic(message.topic);

        if(!/^0x[0-9a-f]{40}$/i.test(input.address)){
            this._reply('Invalid address', message);
            return false;
        }
            
        if(contract == undefined){
            this._reply('Invalid topic', message);
            return false;
        }
        
        if(!contract.functionSignatures.includes(input.functionName)){
            this._reply('Function not allowed', message);
            return false;
        }
            
        // Get code from address and compare it against the contract code
        const code = md5(await this.web3.eth.getCode(input.address));
        if(code != contract.code){
            this._reply('Invalid contract code', message);
            return false;
        }
            
        return true;
    }


    _extractInput(message){
        return {
            address: message.payload.slice(0, 42),
            functionName: '0x' + message.payload.slice(42, 50),
            functionParameters: '0x' + message.payload.slice(50),
            payload: '0x' + message.payload.slice(42)
        }
    }


    _obtainParametersFunc(contract, input){
        const parameterList = this.web3.eth.abi.decodeParameters(contract.allowedFunctions[input.functionName].inputs, input.functionParameters);
        return function(parameterName){
            return parameterList[contract.allowedFunctions[input.functionName][parameterName]];
        }
    }

    _getFactor(input, contract, gasToken){
        if(contract.allowedFunctions[input.functionName].isToken){
            return this.web3.utils.toBN(this.settings.getToken(gasToken).pricePlugin.getFactor());
        } else {
            return this.web3.utils.toBN(1);
        }
    }


    async getBalance(token, input){
        // Determining balances of token used
        if(token.symbol == "ETH")
            return new this.web3.utils.BN(await this.web3.eth.getBalance(input.address));
        else {
            const Token = new this.web3.eth.Contract(erc20ABI);
            Token.options.address = params('gasToken');
            return new this.web3.utils.BN(await Token.methods.balanceOf(input.address).call());  
        }
    }


    async process(error, message){
       
        if(error){
          console.error(error);
        } else {
            
            let input = this._extractInput(message);
            
            const contract = this.settings.getContractByTopic(message.topic);

            console.info("Processing request to: %s, %s", input.address, input.functionName);
            
            if(!this._validateInput(message, input)) return; // TODO Log
            
            const params = this._obtainParametersFunc(contract, input);
            
            const token = this.settings.getToken(params('gasToken'));
            if(token == undefined)
                return reply("Token not allowed", message);

            const gasPrice = this.web3.utils.toBN(params('gasPrice'));
            const gasLimit = this.web3.utils.toBN(params('gasLimit'));
            
            
            // Determine if enough balance for baseToken
            if(contract.allowedFunctions[input.functionName].isToken){
                const Token = new this.web3.eth.Contract(erc20ABI);
                Token.options.address = params('token');
                const baseToken = new this.web3.utils.BN(await Token.methods.balanceOf(input.address).call()); 
                if(balance.lt(this.web3.utils.BN(params('value')))){
                    this._reply("Not enough balance", message);
                    return;
                }
            }
            
            const balance = await this.getBalance(token, input);
            const gasToken = params('gasToken');
            const factor = this._getFactor(input, contract, gasToken);
            
            
            const balanceInETH = balance.div(factor);
            const gasLimitInETH = gasLimit.div(factor);
        
            if(balanceInETH.lt(this.web3.utils.toBN(gasPrice.mul(gasLimit)))) {
                this._reply("Not enough balance", message);
                return;
            }
            
          
          
          // Estimate costs
          const web3Sim = new Web3(ganache.provider({fork: `${config.node.protocol}://${config.node.host}:${config.node.port}`}));
          const simAccounts = await web3Sim.eth.getAccounts();
          let simulatedReceipt = await web3Sim.eth.sendTransaction({
            from: simAccounts[0],
            to: input.address,
            value: 0,
            data: input.payload
          });
      
          const estimatedGas = web3.utils.toBN(simulatedReceipt.gasUsed);
          if(gasLimit.lt(estimatedGas)) {
            return this._reply("Gas limit below estimated gas", message);
          }
      
          this.web3.eth.sendTransaction({
              from: config.node.blockchain.account,
              to: address,
              value: 0,
              data: input.payload,
              gasLimit: gasLimitInETH
          })
          .then(function(receipt){
            return this._reply("Transaction mined;" + receipt.transactionHash, message);
          }).catch(function(err){
            this._reply("Couldn't mine transaction", message);
            // TODO log this?
            console.error(err);
          });


        }
    }  
}

module.exports = MessageProcessor;