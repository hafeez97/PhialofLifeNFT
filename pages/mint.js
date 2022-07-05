import { useState, useEffect } from 'react'
import { initOnboard } from '../utils/onboard'
import { useConnectWallet, useSetChain, useWallets } from '@web3-onboard/react'
import { config } from '../dapp.config'
const { MerkleTree } = require('merkletreejs')
const keccak256 = require('keccak256')
const whitelist = require('../scripts/whitelist')
import { createAlchemyWeb3 } from '@alch/alchemy-web3'
import Head from "next/head";
import Script from "next/Script";


import {
  getTotalMinted,
  getMaxSupply,
  isPausedState,
  isPublicSaleState,
  isPreSaleState,
  getPrice,
} from '../utils/interact'
import log from 'tailwindcss/lib/util/log'


export default function Mint() {
  const web3 = createAlchemyWeb3(process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL)
  const [{ wallet, connecting }, connect, disconnect] = useConnectWallet()
  const [{ chains, connectedChain, settingChain }, setChain] = useSetChain()
  const connectedWallets = useWallets()
  const [maxSupply, setMaxSupply] = useState(0)
  const [totalMinted, setTotalMinted] = useState(0)
  const [maxMintAmount, setMaxMintAmount] = useState(0)
  const [paused, setPaused] = useState(false)
  const [isPublicSale, setIsPublicSale] = useState(false)
  const [isPreSale, setIsPreSale] = useState(false)
  const [status, setStatus] = useState(null)
  const [mintAmount, setMintAmount] = useState(1)
  const [isMinting, setIsMinting] = useState(false)
  const [onboard, setOnboard] = useState(null)
  const [price, setPrice] = useState(0)
  const convert = require('ethereum-unit-converter')


//Minting functionality
  const contract = require('../artifacts/contracts/PhialofLife.sol/PhialofLife.json')
  const nftContract = new web3.eth.Contract(contract.abi, config.contractAddress)
  // Calculate merkle root from the whitelist array
  const leafNodes = whitelist.map((addr) => keccak256(addr))
  const merkleTree = new MerkleTree(leafNodes, keccak256, { sortPairs: true })
  const root = merkleTree.getRoot()

  const presaleMint = async (mintAmount) => {
    if (!window.ethereum.selectedAddress) {
      return {
        success: false,
        status: 'To be able to mint, you need to connect your wallet'
      }
    }

    const leaf = keccak256(window.ethereum.selectedAddress)
    const proof = merkleTree.getHexProof(leaf)

    // Verify Merkle Proof
    const isValid = merkleTree.verify(proof, leaf, root)

    if (!isValid) {
      return {
        success: false,
        status: 'You are not on the whitelist!'
      }
    }

    const nonce = await web3.eth.getTransactionCount(
      window.ethereum.selectedAddress,
      'latest'
    )

    // Set up our Ethereum transaction presale
    const tx = {
      to: config.contractAddress,
      from: window.ethereum.selectedAddress,
      value: parseInt(
        web3.utils.toWei(String(price * mintAmount), 'ether')
      ).toString(16), // hex

      data: nftContract.methods
        .presaleMint(window.ethereum.selectedAddress, mintAmount, proof)
        .encodeABI(),
      nonce: nonce.toString(16)
    }

    try {
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [tx]
      })

      return {
        success: true,
        status: (
          console.log({txHash})
          // <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">
          //   Minted
          //   {/*<p>{`https://etherscan.io/tx/${txHash}`}</p>*/}
          // </a>
        )
      }
    } catch (error) {
      return {
        success: false,
        status: '😞 Smth went wrong:' + error.message
      }
    }
  }
  const publicMint = async (mintAmount) => {
    if (!window.ethereum.selectedAddress) {
      return {
        success: false,
        status: 'To be able to mint, you need to connect your wallet'
      }
    }

    const nonce = await web3.eth.getTransactionCount(
      window.ethereum.selectedAddress,
      'latest'
    )
    // Set up our Ethereum transaction publicsale
    const tx = {
      to: config.contractAddress,
      from: window.ethereum.selectedAddress,
      value: parseInt(
        web3.utils.toWei(String(price * mintAmount), 'ether')
      ).toString(16), // hex
      data: nftContract.methods.publicSaleMint(mintAmount).encodeABI(),
      nonce: nonce.toString(16)
    }

    try {
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [tx]
      })

      return {
        success: true,
        status: (
          <a href={`https://etherscan.io/tx/${txHash}`} target="_blank" rel="noreferrer">
            <p>✅ Check out your transaction on Etherscan:</p>
            <p>{`https://etherscan.io/tx/${txHash}`}</p>
          </a>
        )
      }
    } catch (error) {
      return {
        success: false,
        status: '😞 Smth went wrong:' + error.message
      }
    }
  }
  //mint stuff copied end

  useEffect(() => {
    setOnboard(initOnboard)
  }, [])


  useEffect(() => {
    if (!connectedWallets.length) return

    const connectedWalletsLabelArray = connectedWallets.map(
      ({ label }) => label
    )
    window.localStorage.setItem(
      'connectedWallets',
      JSON.stringify(connectedWalletsLabelArray)
    )
  }, [connectedWallets])

  useEffect(() => {
    if (!onboard) return
    const previouslyConnectedWallets = JSON.parse(
      window.localStorage.getItem('connectedWallets')
    )

    if (previouslyConnectedWallets?.length) {
      async function setWalletFromLocalStorage() {
        await connect({
          autoSelect: {
            label: previouslyConnectedWallets[0],
            disableModals: true
          }
        })
      }
      setWalletFromLocalStorage()
    }
  }, [onboard, connect])

  useEffect(() => {
    const onit = async () => {
      const rawPrice = await getPrice()
      const result = convert(rawPrice, 'wei')
      setPrice(result.ether)
    }
    onit()
  }, [])


  useEffect(() => {
    const init = async () => {
      setMaxSupply(await getMaxSupply())
      setTotalMinted(await getTotalMinted())
      setPaused(await isPausedState())
      setIsPublicSale(await isPublicSaleState())
      const isPreSale = await isPreSaleState()
      setIsPreSale(isPreSale)
      setMaxMintAmount(
        isPreSale ? config.presaleMaxMintAmount : config.maxMintAmount
      )
    }
    init()
  }, [])

  const incrementMintAmount = () => {

    if (isPreSale) {
      if (mintAmount < 5){
        setMintAmount(mintAmount + 1)
      }
    }else {
      setMintAmount(mintAmount + 1)
    }
  }

  const decrementMintAmount = () => {
    if (mintAmount > 1) {
      setMintAmount(mintAmount - 1)
    }
  }

  const presaleMintHandler = async () => {
    setIsMinting(true)
    const { success, status } = await presaleMint(mintAmount)
    setStatus({
      success,
      message: status
    })
    setIsMinting(false)
  }
  const publicMintHandler = async () => {
    setIsMinting(true)
    const { success, status } = await publicMint(mintAmount)
    setStatus({
      success,
      message: status
    })
    setIsMinting(false)
  }

  return (
    <>
      <div>
        <Head>
          <title>Phial of Life</title>
          <link rel="icon" href="/favicon.ico" />
          <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no"/>
            <link rel="icon" href="favicon.ico" type="image/x-icon" />
            <link href="assets/css/style.css" rel="stylesheet" type="text/css" />
          <link rel="icon" href="favicon.ico" type="image/x-icon" />
        </Head>
<main>
  <section className="home-menu">
    <header className="header-main">
      <div className="nav-area-full">
        <div className="container-fluid">
          <div className="row" id="home-row">
            <div className="col-md-1 logo-area">
              <div className="logo" id="wallet-logo">
                <a href="index.html">
                  <h6>Phial
                    <span>of Life
                      </span>
                  </h6>
                </a>
              </div>
            </div>
            <div className="col-md-8 d-flex">
            </div>
            <div className="col-md-3">
            </div>
          </div>
        </div>
      </div>
    </header>
  </section>
  <section className="home-tab">
    <div className="container-fluid">
      <div className="row">
        <header className="header-main">
        </header>
        <div className="">
          <div className="tabs-custom general">
            <div id="wallet" className="">
              <div className="row justify-content-center">
                <div className="">
                  <div className="roadmap-box">
                    <div className="roadmap-box-inner">
                      <div>
                        <h4>{paused ? 'Paused' : isPreSale ? 'Pre-Sale' : isPublicSale ? "Public Sale" : "Sale In-Active"}</h4>
                      </div>
                      <div className="number">
                          <span className="minus" onClick={decrementMintAmount}>-
                          </span>
                        <input type="text" value={mintAmount} />
                        <span className="plus" onClick={incrementMintAmount}>+
                          </span>
                      </div>
                      <h4>{Number.parseFloat(price * mintAmount).toFixed(
                        4
                      )}</h4>
                      <h6>Price per NFT - {price} ETH
                        {
                          isPreSale && <span>Max per wallet- 5
                          </span>
                        }
                        <span>{totalMinted} / 3000
                          </span>
                      </h6>
                      {status && (
                        <div>
                          <p>{status.message}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="row" id="ct-row">
                <div className="col-md-3">
                  <div className="main-logo">
                    <img className="img-fluid" src="assets/images/logo.gif" alt="*" />
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="ct-txt">
                    {wallet ? (
                      <a
                        href="#"
                         onClick={isPreSale ? presaleMintHandler : publicMintHandler}
                         className={paused || isMinting && "disableAnchor"}
                      >
                        {isMinting ? 'Minting...' : 'Mint'}
                      </a>
                    ) : (
                      <a href="#" onClick={() => connect()}>CONNECT A WALLET
                      </a>
                    )}
                    <h5>Copyright © 2022 Oluju. All rights reserved
                    </h5>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="top-links">
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</main>

        <Script src="assets/js/jquery.min.js">
        </Script>
        <Script type="text/javascript" src="assets/js/bootstrap.min.js">
        </Script>
        <Script type="text/javascript" src="assets/js/slick.js">
        </Script>
        <Script type="text/javascript" src="assets/js/jquery.fancybox.min.js">
        </Script>
        <Script type="text/javascript" src="assets/js/wow.js">
        </Script>
        <Script type="text/javascript" src="assets/js/functions.js">
        </Script>
      </div>


    </>
  )
}