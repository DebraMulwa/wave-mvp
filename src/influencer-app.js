Influencer = {
  loading: false,
  contracts: {},
  account: null,
  web3Provider: null,
  chart: null,
  metrics: {
    balance: "--",
    funded: 0,
    pending: 0,
  },
  rates: {
    kesPerEth: 180000, // editable conversion rate for KES
  },

  load: async () => {
    console.log("Influencer App loading…")
    await Influencer.loadWeb3()
    await Influencer.loadAccount()
    await Influencer.loadContract()
    await Influencer.render()
  },

  loadWeb3: async () => {
    if (window.ethereum) {
      Influencer.web3Provider = window.ethereum
      window.web3 = new Web3(window.ethereum)

      try {
        await window.ethereum.request({ method: "eth_requestAccounts" })
      } catch (e) {
        console.error("User blocked MetaMask:", e)
      }
    } else {
      alert("Install MetaMask first.")
    }
  },

  loadAccount: async () => {
    const accounts = await window.ethereum.request({
      method: "eth_accounts",
    })
    Influencer.account = accounts[0]
    $("#account").html(Influencer.account)
    $("#userChip").text("Hello, WVR 🏄")
  },

  loadContract: async () => {
    const wave = await $.getJSON("Wave.json")
    const networkId = await window.web3.eth.net.getId()
    const deployed = wave.networks?.[networkId]
    if (!deployed?.address) {
      throw new Error(`Wave not deployed on chain id ${networkId}. Deploy and refresh.`)
    }
    Influencer.wave = new window.web3.eth.Contract(wave.abi, deployed.address)
  },

  render: async () => {
    if (Influencer.loading) return
    Influencer.setLoading(true)
    const summary = await Influencer.renderTasks()
    await Influencer.renderMetrics(summary)
    await Influencer.renderPayouts()
    Influencer.setLoading(false)
  },

  renderTasks: async () => {
    $("#inflTasks").html("")
    const taskCount = Number(await Influencer.wave.methods.taskCount().call())
    const summary = { funded: 0, pending: 0 }

    for (let i = 1; i <= taskCount; i++) {
      const t = await Influencer.wave.methods.getTask(i).call()

      const id = Number(t.id ?? t[0])
      const content = t.content ?? t[1]
      const influencer = (t.influencer ?? t[3]).toLowerCase()
      const proof = t.proof ?? t[6]
      const proofSubmitted = t.proofSubmitted ?? t[7]
      const approved = t.completed ?? t[2]
      const paid = t.paid ?? t[5]
      const value = Number(t.value ?? t[4])
      const rejectionNote = t.rejectionNote ?? t[8]

      if (influencer !== Influencer.account.toLowerCase()) continue

      if (value > 0 || paid) summary.funded += 1
      if (!proofSubmitted) summary.pending += 1

let html = `
<div class="tasks-row">
  <div class="task-col">
    <div class="task-id">#${id}</div>
    <div class="task-content">${content}</div>
  </div>
  <div class="task-col task-actions">
`

// NORMAL SUBMIT
if (!proofSubmitted && !rejectionNote) {
  html += `
    <button class="submitProofBtn" data-id="${id}">
      Submit Proof
    </button>
  `
}

// REJECTED STATE
if (!proofSubmitted && rejectionNote) {
  html += `
    <span class="status-tag red">Rejected: ${rejectionNote}</span>
    <button class="submitProofBtn" data-id="${id}">
      Resubmit Proof
    </button>
  `
}

// PROOF SUBMITTED
if (proofSubmitted && !approved && !rejectionNote) {
  html += `
    <span class="status-tag yellow">Proof submitted · Awaiting review</span>
  `
}

// APPROVED WAITING PAYMENT
if (approved && !paid) {
  html += `<span class="status-tag blue">Approved · Waiting for release</span>`
}

// PAID
if (paid) {
  html += `<span class="status-tag green">Paid ✔️</span>`
  if (proof) {
    html += `<a class="status-tag" href="${proof}" target="_blank">Proof link</a>`
  }
}

html += `</div></div>`
$("#inflTasks").append(html)
    }
    return summary
  },

  renderMetrics: async (summary) => {
    try {
      const balanceWei = await window.web3.eth.getBalance(Influencer.account)
      const balanceEth = parseFloat(window.web3.utils.fromWei(balanceWei, "ether"))

      const formattedBalance = `${balanceEth.toFixed(4)} Ξ`
      $("#metricBalance").text(formattedBalance)

      const kesValue = balanceEth * Influencer.rates.kesPerEth
      const kesPretty = kesValue.toLocaleString(undefined, { maximumFractionDigits: 0 })
      $("#cardBalance").text(`KES ${kesPretty}`)
    } catch (err) {
      console.error("Error fetching balance", err)
      $("#metricBalance").text("--")
      $("#cardBalance").text("--")
    }

    const funded = summary ? summary.funded : "--"
    const pending = summary ? summary.pending : "--"

    $("#metricFunded").text(funded)
    $("#metricPending").text(pending)
  },

  renderPayouts: async () => {
    if (!window.Chart || !Influencer.account) return

    try {
      const events = await Influencer.wave.getPastEvents("TaskPaid", {
        filter: { influencer: Influencer.account },
        fromBlock: 0,
        toBlock: "latest",
      })

      if (!events.length) {
        $("#paymentsEmpty").show()
        if (Influencer.chart) {
          Influencer.chart.destroy()
          Influencer.chart = null
        }
        return
      }

      $("#paymentsEmpty").hide()

      const withTime = await Promise.all(
        events.map(async (ev) => {
          const block = await window.web3.eth.getBlock(ev.blockNumber)
          return {
            ts: block.timestamp * 1000,
            amount: parseFloat(window.web3.utils.fromWei(ev.returnValues.value, "ether")),
            id: ev.returnValues.id,
          }
        })
      )

      const sorted = withTime.sort((a, b) => a.ts - b.ts)
      let running = 0
      const labels = sorted.map((p) => {
        const d = new Date(p.ts)
        return `${d.getMonth() + 1}/${d.getDate()}`
      })
      const data = sorted.map((p) => {
        running += p.amount
        return running
      })

      const ctx = document.getElementById("paymentsChart").getContext("2d")
      if (Influencer.chart) Influencer.chart.destroy()

      Influencer.chart = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Cumulative ETH received",
              data,
              tension: 0.35,
              borderColor: "#6d7cff",
              backgroundColor: "rgba(109, 124, 255, 0.18)",
              fill: true,
              borderWidth: 3,
              pointRadius: 4,
              pointBackgroundColor: "#ffffff",
              pointBorderColor: "#6d7cff",
            },
          ],
        },
        options: {
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label(context) {
                  return `${context.raw.toFixed(4)} ETH received`;
                },
              },
            },
          },
          scales: {
            x: {
              ticks: { color: "#475569" },
              grid: { display: false },
            },
            y: {
              ticks: {
                color: "#475569",
                stepSize: 1,
                callback: (value) => `${value} Ξ`,
              },
              grid: { color: "rgba(15,23,42,0.06)" },
              suggestedMin: 0,
              suggestedMax: 5,
            },
          },
        },
      })
    } catch (err) {
      console.error("Error rendering payouts chart", err)
    }
  },

  submitProof: async (taskId) => {
    const link = prompt("Paste proof link (URL):")
    if (!link || !link.startsWith("http")) return alert("Invalid link")

    try {
      await Influencer.wave.methods.submitProof(taskId, link).send({ from: Influencer.account })
      alert("Proof submitted!")
      Influencer.render()
    } catch (err) {
      console.error(err)
      alert("Something went wrong")
    }
  },

  setLoading: (boolean) => {
    Influencer.loading = boolean
    boolean ? $("#loader").show() : $("#loader").hide()
  },
}

$(document).on("click", ".submitProofBtn", function () {
  const id = $(this).data("id")
  Influencer.submitProof(id)
})

window.addEventListener("load", function () {
  Influencer.load()
})
