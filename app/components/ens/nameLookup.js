import React, { Fragment, PureComponent } from 'react';
import web3 from 'web3';
import { connect } from 'react-redux';
import { actions as accountActions, getDefaultAccount } from '../../reducers/accounts';
import Hidden from '@material-ui/core/Hidden';
import Typography from '@material-ui/core/Typography';
import ENSSubdomainRegistry from 'Embark/contracts/ENSSubdomainRegistry';
import { Button, Field, TextInput, MobileSearch, Card, Info, Text } from '../../ui/components'
import { IconCheck } from '../../ui/icons'
import theme from '../../ui/theme'
import { withFormik } from 'formik';
import PublicResolver from 'Embark/contracts/PublicResolver';
import { hash } from 'eth-ens-namehash';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import RegisterSubDomain from '../ens/registerSubDomain';
import StatusLogo from '../../ui/icons/components/StatusLogo'
import EnsLogo from '../../ui/icons/logos/ens.png';
import { formatPrice } from '../ens/utils';
import CheckCircle from '../../ui/icons/components/baseline_check_circle_outline.png';
const { getPrice, getExpirationTime } = ENSSubdomainRegistry.methods;
import NotInterested from '@material-ui/icons/NotInterested';
import Face from '@material-ui/icons/Face';

const invalidSuffix = '0000000000000000000000000000000000000000'
const nullAddress = '0x0000000000000000000000000000000000000000'
const validAddress = address => address != nullAddress;
const validStatusAddress = address => !address.includes(invalidSuffix);
const formatName = domainName => domainName.includes('.') ? domainName : `${domainName}.stateofus.eth`;
const getDomain = fullDomain => formatName(fullDomain).split('.').slice(1).join('.');
const hashedDomain = domainName => hash(getDomain(domainName));
const { fromWei } = web3.utils;

const cardStyle = {
  width: '100%',
  padding: '30px',
  height: '425px'
}

const addressStyle = {
  fontSize: '18px',
  fontWeight: 400,
  cursor: 'copy',
  wordWrap: 'break-word',
}

const backButton = {
  fontSize: '40px',
  color: theme.accent,
  cursor: 'pointer'
}

const generatePrettyDate = (timestamp) => new Date(timestamp * 1000).toDateString();

const DisplayBox = ({ displayType, pubKey }) => (
  <div style={{ border: '1px solid #EEF2F5', borderRadius: '8px', margin: '1em', display: 'flex', flexDirection: 'column', justifyContent: 'space-around', minHeight: '4em' }}>
    <div style={{ margin: '3%', wordBreak: 'break-word' }}>
      <div style={{ fontSize: '14px', color: '#939BA1' }}>{displayType}</div>
      <Typography type='body1'>{pubKey}</Typography>
    </div>
  </div>
);

const MobileAddressDisplay = ({ domainName, address, statusAccount, expirationTime, defaultAccount, isOwner }) => (
  <Fragment>
    <Info background={isOwner ? '#44D058' : '#000000'} style={{ margin: '0.4em', boxShadow: '0px 6px 10px rgba(0, 0, 0, 0.2)' }}>
      <Typography variant="title" style={
        { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly', height: '4em', color: '#ffffff', textAlign: 'center', margin: '10%' }
      }>
        {isOwner ? <Face style={{ marginBottom: '0.5em', fontSize: '2em' }} /> : <NotInterested style={{ marginBottom: '0.5em', fontSize: '2em' }}/>}
        <b>{formatName(domainName).toUpperCase()}</b>
        <div style={{ fontWeight: 300 }}>
          {expirationTime && <i>Locked until {generatePrettyDate(expirationTime)}</i>}
        </div>
      </Typography>
    </Info>
    <Typography type='subheading' style={{ textAlign: 'center', fontSize: '17px', margin: '1em 0 0.3em 0' }}>{isOwner ? 'You\'re the owner of this name' : 'Name is unavailable'}</Typography>
    <Typography type='body2' style={{ textAlign: 'center' }}>registered to the addresses below</Typography>
    <DisplayBox displayType='Wallet Address' pubKey={address} />
    {validStatusAddress(statusAccount) && <DisplayBox displayType='Contact Code' pubKey={statusAccount} />}
  </Fragment>
)

class RenderAddresses extends PureComponent {
  state = { copied: false }

  render() {
    const { domainName, address, statusAccount, expirationTime, defaultAccount } = this.props
    const { copied } = this.state
    const markCopied = (v) => { this.setState({ copied: v }) }
    const isCopied = address => address == copied;
    const renderCopied = address => isCopied(address) && <span style={{ color: theme.positive }}><IconCheck/>Copied!</span>;
    const isOwner = defaultAccount === address;
    return (
      <Fragment>
        <Hidden mdDown>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <Info.Action title="Click to copy"><b>{formatName(domainName).toUpperCase()}</b>{expirationTime && <i> (Expires {generatePrettyDate(expirationTime)})</i>} Resolves To:</Info.Action>
            {address && <Text style={{ marginTop: '1em' }}>Ethereum Address {renderCopied(address)}</Text>}
            <CopyToClipboard text={address} onCopy={markCopied}>
              <div style={addressStyle}>{address}</div>
            </CopyToClipboard>
            {validStatusAddress(statusAccount) && <Text style={{ marginTop: '1em' }}>Status Address {renderCopied(statusAccount)}</Text>}
            {validStatusAddress(statusAccount) && <CopyToClipboard text={statusAccount} onCopy={markCopied}>
              <div style={{ ...addressStyle, color: isCopied ? theme.primary : null }}>{statusAccount}</div>
            </CopyToClipboard>}
          </div>
        </Hidden>
        <Hidden mdUp>
          <MobileAddressDisplay {...this.props} isOwner={isOwner} />
        </Hidden>
      </Fragment>
    )
  }
}

const RegisterInfoCard = ({ formattedDomain, domainPrice }) => (
  <Fragment>
    <Hidden mdDown>
      <Info.Action title="No address is associated with this domain">
        <span style={{ color: theme.accent }}>{formattedDomain.toLowerCase()}</span> can be registered for {!!domainPrice && formatPrice(fromWei(domainPrice))} SNT
      </Info.Action>
    </Hidden>
    <Hidden mdUp>
      <Info background="#415be3" style={{ margin: '0.4em' }}>
        <Typography variant="title" style={
          { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly', height: '4em', color: '#ffffff', textAlign: 'center', margin: '10%' }
        }>
          <img src={CheckCircle} style={{ maxWidth: '2.5em', marginBottom: '0.5em' }} />
          <b>{formattedDomain.toLowerCase()}</b>
          <div style={{ fontWeight: 300 }}>
            {!!domainPrice && formatPrice(fromWei(domainPrice))} SNT / 1 year
          </div>
        </Typography>
      </Info>
    </Hidden>
    <Hidden mdUp>
      <Typography style={{ textAlign: 'center', padding: '1.5em' }}>
        This name will be pointed to the wallet address and contact code below
      </Typography>
    </Hidden>
  </Fragment>
)

class Register extends PureComponent {
  state = { domainPrice: null };

  componentDidMount() {
    const { domainName } = this.props;
    getPrice(hashedDomain(domainName))
      .call()
      .then((res) => { this.setState({ domainPrice: res })});
  }

  onRegistered = (address, statusAccount) => {
    const { domainPrice } = this.state;
    const { subtractFromBalance } = this.props;
    subtractFromBalance(domainPrice);
    this.setState({ registered: { address, statusAccount } });
  }

  render() {
    const { domainName, setStatus, style } = this.props;
    const { domainPrice, registered } = this.state;
    const formattedDomain = formatName(domainName);
    const formattedDomainArray = formattedDomain.split('.')
    return (
      <div style={style}>
        {!registered ?
         <Fragment>
           <RegisterInfoCard {...{ formattedDomain, domainPrice }}/>
           <RegisterSubDomain
             subDomain={formattedDomainArray[0]}
             domainName={formattedDomainArray.slice(1).join('.')}
             domainPrice={domainPrice}
             registeredCallbackFn={this.onRegistered} />
         </Fragment> :
         <RenderAddresses {...this.props} address={registered.address} statusAccount={registered.statusAccount} />}
        <div style={backButton} onClick={() => setStatus(null)}>&larr;</div>
      </div>
    )
  }
}

const mapDispatchToProps = dispatch => ({
  subtractFromBalance(amount) {
    dispatch(accountActions.subtractfromSntTokenBalance(amount));
  },
});

const mapStateToProps = state => ({
  defaultAccount: getDefaultAccount(state)
})

const ConnectedRegister = connect(mapStateToProps, mapDispatchToProps)(Register);

const DisplayAddress = connect(mapStateToProps)((props) => (
  <Fragment>
    {validAddress(props.address) ?
     <RenderAddresses {...props} />
     :
     <Hidden mdUp>
       <Info.Action title="No address is associated with this domain">
         {props.domainName.toUpperCase()}
       </Info.Action>
     </Hidden>
    }
    <div style={backButton} onClick={() => props.setStatus(null)}>&larr;</div>
  </Fragment>
))

const LookupForm = ({ handleSubmit, values, handleChange, justSearch }) => (
  <Fragment>
    <form onSubmit={handleSubmit}>
      <Hidden mdDown>
        <Field label="Enter Domain or Status Name" wide>
          <TextInput
            value={values.domainName}
            name="domainName"
            onChange={handleChange}
            wide
            required />
        </Field>
      </Hidden>
      <Hidden mdUp>
        <MobileSearch
          search
          name="domainName"
          placeholder='Search for vacant name'
          value={values.domainName}
          onChange={handleChange}
          required
          wide />
        {!justSearch && <Typography variant="subheading" style={{ color: '#939ba1', textAlign: 'center', marginTop: '25vh' }}>
          Symbols * / <br/>
          are not supported
        </Typography>}
      </Hidden>
      <Hidden mdDown>
        <Button mode="strong" type="submit" wide>
          Lookup Address
        </Button>
      </Hidden>
    </form>
  </Fragment>
)

const InnerForm = ({
  values,
  errors,
  touched,
  handleChange,
  handleBlur,
  handleSubmit,
  isSubmitting,
  status,
  setStatus
}) => (
  <div>
    <Hidden mdDown>
      <span style={{ display: 'flex', justifyContent: 'space-evenly', marginBottom: '10px' }}>
        <StatusLogo />
        <img  style={{ maxWidth: '150px', alignSelf: 'center' }} src={EnsLogo} alt="Ens Logo"/>
      </span>
    </Hidden>
    {!status
     ? <LookupForm {...{ handleSubmit, values, handleChange }} />
     : validAddress(status.address) ?
     <DisplayAddress
       domainName={values.domainName}
       address={status.address}
       statusAccount={status.statusAccount}
       expirationTime={status.expirationTime}
       setStatus={setStatus} /> :
     <div>
       <LookupForm {...{ handleSubmit, values, handleChange }} justSearch />
       <ConnectedRegister
         style={{ position: 'relative' }}
         setStatus={setStatus}
         domainName={values.domainName}  />
     </div>
    }
  </div>
)

const NameLookup = withFormik({
  mapPropsToValues: props => ({ domainName: '' }),
  async handleSubmit(values, { status, setSubmitting, setStatus }) {
    const { domainName } = values;
    const { addr, text } = PublicResolver.methods;
    const lookupHash = hash(formatName(domainName));
    const address = await addr(lookupHash).call();
    const statusAccount = await text(lookupHash, 'statusAccount').call();
    const expirationTime = await getExpirationTime(lookupHash).call();
    setStatus({ address, statusAccount, expirationTime });
  }
})(InnerForm)

export default NameLookup;