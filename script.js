/*
 * script.js
 *
 * This file powers the interactivity for the advanced Darubuddy expense
 * calculator. It supports adding multiple participants and tracking
 * individual expenses where each purchase can be shared among a subset of
 * the group. The script computes who owes whom, displays a concise
 * settlement, and persists sessions to localStorage. Older, simple
 * equal‑split calculations are still rendered correctly for backwards
 * compatibility.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Grab references to DOM elements used throughout the script
  const namesContainer = document.getElementById('names-container');
  const addPersonBtn = document.getElementById('add-person');
  const expensesContainer = document.getElementById('expenses-container');
  const addExpenseBtn = document.getElementById('add-expense');
  const calculateBtn = document.getElementById('calculate-btn');
  const resultsContainer = document.getElementById('results');
  const saveBtn = document.getElementById('save-calculation');
  const calculationsList = document.getElementById('calculations-list');

  // State variables
  let nameCount = 0;
  let lastCalculation = null;

  /**
   * Retrieve an array of participant names currently entered in the UI.
   * Empty strings are ignored. Leading/trailing whitespace is trimmed.
   *
   * @returns {string[]} An array of participant names.
   */
  function getParticipants() {
    const inputs = namesContainer.querySelectorAll('.name-field input');
    return Array.from(inputs)
      .map((input) => input.value.trim())
      .filter((name) => name !== '');
  }

  /**
   * Synchronise all expense inputs with the current list of participants.
   * This updates payer select boxes and shared‑by checkboxes whenever
   * participants are added, removed or renamed.
   */
  function updateExpenseParticipants() {
    const participants = getParticipants();
    const expenseItems = expensesContainer.querySelectorAll('.expense-item');
    expenseItems.forEach((item) => {
      // Update the payer select options
      const payerSelect = item.querySelector('.expense-payer');
      const currentValue = payerSelect.value;
      payerSelect.innerHTML = '';
      participants.forEach((name) => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        payerSelect.appendChild(option);
      });
      // Retain selection if it still exists
      if (participants.includes(currentValue)) {
        payerSelect.value = currentValue;
      }
      // Update the shared‑by checkboxes
      const sharedContainer = item.querySelector('.expense-shared-by');
      // Preserve previous checked state by name
      const prevChecked = {};
      sharedContainer.querySelectorAll('input[type="checkbox"]').forEach((chk) => {
        prevChecked[chk.value] = chk.checked;
      });
      sharedContainer.innerHTML = '';
      participants.forEach((name) => {
        const label = document.createElement('label');
        label.classList.add('shared-option');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = name;
        // By default select all new participants; otherwise keep previous state
        checkbox.checked = prevChecked[name] !== undefined ? prevChecked[name] : true;
        label.appendChild(checkbox);
        const span = document.createElement('span');
        span.textContent = name;
        label.appendChild(span);
        sharedContainer.appendChild(label);
      });
    });
  }

  /**
   * Create a new participant name input. Each entry includes a text input
   * with a placeholder and a remove button. Removing a participant will
   * trigger an update of all expenses to reflect the new group.
   *
   * @param {string} [name] Optional default name for the field.
   */
  function addNameField(name) {
    nameCount++;
    const wrapper = document.createElement('div');
    wrapper.classList.add('name-field');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'name-input';
    input.value = name || `Friend ${nameCount}`;
    input.placeholder = `Friend ${nameCount}`;
    // When a name is edited, update expense selections
    input.addEventListener('input', () => {
      updateExpenseParticipants();
    });
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-person';
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', 'Remove person');
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', () => {
      wrapper.remove();
      nameCount--;
      updateExpenseParticipants();
    });
    wrapper.appendChild(input);
    wrapper.appendChild(removeBtn);
    namesContainer.appendChild(wrapper);
    updateExpenseParticipants();
  }

  /**
   * Initialise the participants with a default number of entries. This is
   * called on page load and when resetting the form after saving a
   * calculation.
   *
   * @param {number} n The number of participant fields to create.
   */
  function initializeNames(n) {
    namesContainer.innerHTML = '';
    nameCount = 0;
    for (let i = 0; i < n; i++) {
      addNameField(`Friend ${i + 1}`);
    }
  }

  /**
   * Append a new expense item to the expenses container. An expense
   * comprises a description field, an amount input, a payer select and a
   * list of checkboxes indicating who shared the purchase. A remove button
   * allows the user to delete an individual expense.
   */
  function addExpense() {
    const expense = document.createElement('div');
    expense.className = 'expense-item';

    // First row: description, amount and remove button
    const row1 = document.createElement('div');
    row1.className = 'expense-row';
    const descInput = document.createElement('input');
    descInput.type = 'text';
    descInput.className = 'expense-desc';
    descInput.placeholder = 'Description (e.g. Beer)';
    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.className = 'expense-amount';
    amountInput.placeholder = 'Amount (₹)';
    amountInput.min = '0';
    amountInput.step = '0.01';
    const removeBtn = document.createElement('button');
    removeBtn.className = 'remove-expense';
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', 'Remove expense');
    removeBtn.innerHTML = '&times;';
    removeBtn.addEventListener('click', () => {
      expense.remove();
    });
    row1.appendChild(descInput);
    row1.appendChild(amountInput);
    row1.appendChild(removeBtn);

    // Second row: payer selector
    const row2 = document.createElement('div');
    row2.className = 'expense-row';
    const payerLabel = document.createElement('label');
    payerLabel.textContent = 'Paid by:';
    const payerSelect = document.createElement('select');
    payerSelect.className = 'expense-payer';
    row2.appendChild(payerLabel);
    row2.appendChild(payerSelect);

    // Third row: shared-by checkboxes
    const row3 = document.createElement('div');
    row3.className = 'expense-row';
    const shareLabel = document.createElement('label');
    shareLabel.textContent = 'Shared by:';
    const sharedContainer = document.createElement('div');
    sharedContainer.className = 'expense-shared-by';
    row3.appendChild(shareLabel);
    row3.appendChild(sharedContainer);

    expense.appendChild(row1);
    expense.appendChild(row2);
    expense.appendChild(row3);
    expensesContainer.appendChild(expense);
    // Populate the payer select and shared-by checkboxes based on current participants
    updateExpenseParticipants();
  }

  /**
   * Compute the settlement for the current set of participants and
   * expenses. Displays a summary of what each person owes or should
   * receive, followed by a recommended series of payments to settle the
   * debts. If there are no participants or expenses, appropriate
   * messages are shown instead.
   */
  function calculateAdvanced() {
    const participants = getParticipants();
    // Basic validation
    if (participants.length === 0) {
      resultsContainer.textContent = 'Please add at least one participant.';
      saveBtn.style.display = 'none';
      return;
    }
    // Build an array of expense objects from the DOM
    const expenseItems = expensesContainer.querySelectorAll('.expense-item');
    const expenses = [];
    let totalSpent = 0;
    expenseItems.forEach((item) => {
      const description = item.querySelector('.expense-desc').value.trim() || 'Expense';
      const amountVal = parseFloat(item.querySelector('.expense-amount').value);
      const payer = item.querySelector('.expense-payer').value;
      const sharedBy = [];
      item.querySelectorAll('.expense-shared-by input[type="checkbox"]').forEach((chk) => {
        if (chk.checked) sharedBy.push(chk.value);
      });
      // Only consider expenses with a valid amount and at least one participant
      if (!isNaN(amountVal) && amountVal > 0 && payer && sharedBy.length > 0) {
        expenses.push({ description, amount: amountVal, payer, sharedBy });
        totalSpent += amountVal;
      }
    });
    if (expenses.length === 0) {
      resultsContainer.textContent = 'Please add at least one expense with an amount.';
      saveBtn.style.display = 'none';
      return;
    }

    // Initialise totals per participant
    const totals = {};
    participants.forEach((name) => {
      totals[name] = { paid: 0, owed: 0 };
    });
    // Sum up each expense: payer pays whole amount, shared participants owe a share
    expenses.forEach((exp) => {
      const share = exp.amount / exp.sharedBy.length;
      totals[exp.payer].paid += exp.amount;
      exp.sharedBy.forEach((name) => {
        totals[name].owed += share;
      });
    });
    // Calculate net balances
    const nets = participants.map((name) => {
      const net = totals[name].paid - totals[name].owed;
      return { name, net: parseFloat(net.toFixed(2)) };
    });
    // Prepare settlement instructions
    const settlement = [];
    // Separate debtors and creditors
    const debtors = nets
      .filter((x) => x.net < -0.01)
      .map((x) => ({ name: x.name, amount: -x.net }));
    const creditors = nets
      .filter((x) => x.net > 0.01)
      .map((x) => ({ name: x.name, amount: x.net }));
    let i = 0;
    let j = 0;
    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i];
      const creditor = creditors[j];
      const settled = Math.min(debtor.amount, creditor.amount);
      settlement.push({ from: debtor.name, to: creditor.name, amount: settled });
      debtor.amount -= settled;
      creditor.amount -= settled;
      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }
    // Render results on the page
    resultsContainer.innerHTML = '';
    const summaryHeading = document.createElement('h4');
    summaryHeading.textContent = 'Summary';
    resultsContainer.appendChild(summaryHeading);
    const summaryList = document.createElement('ul');
    summaryList.className = 'summary-list';
    nets.forEach((item) => {
      const li = document.createElement('li');
      if (Math.abs(item.net) < 0.01) {
        li.textContent = `${item.name}: Settled`;
      } else if (item.net > 0) {
        li.textContent = `${item.name} should receive ₹${item.net.toFixed(2)}`;
      } else {
        li.textContent = `${item.name} owes ₹${(-item.net).toFixed(2)}`;
      }
      summaryList.appendChild(li);
    });
    resultsContainer.appendChild(summaryList);
    if (settlement.length > 0) {
      const settleHeading = document.createElement('h4');
      settleHeading.textContent = 'Recommended payments';
      resultsContainer.appendChild(settleHeading);
      const settleList = document.createElement('ul');
      settleList.className = 'settle-list';
      settlement.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = `${item.from} → ${item.to}: ₹${item.amount.toFixed(2)}`;
        settleList.appendChild(li);
      });
      resultsContainer.appendChild(settleList);
    }
    // Persist the current calculation in memory for saving later
    lastCalculation = {
      type: 'advanced',
      timestamp: new Date().toISOString(),
      participants,
      expenses,
      totals: nets,
      settlement,
      totalSpent: parseFloat(totalSpent.toFixed(2)),
    };
    saveBtn.style.display = 'inline-block';
  }

  /**
   * Render all saved calculations (both advanced and simple) from
   * localStorage into the sidebar. Each entry displays a summary and can be
   * expanded to reveal full details. Advanced sessions show a list of
   * expenses and the recommended payments, while simple sessions show the
   * equal split amounts.
   */
  function renderCalculations() {
    calculationsList.innerHTML = '';
    const calculations = JSON.parse(
      localStorage.getItem('darubuddy_calculations') || '[]'
    );
    calculations
      .slice()
      .reverse()
      .forEach((calc) => {
        const li = document.createElement('li');
        li.className = 'calculation-item';
        // Summary row
        const summary = document.createElement('div');
        summary.className = 'calculation-summary';
        const date = new Date(calc.timestamp);
        const localeString = date.toLocaleString('en-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        });
        const summaryText = document.createElement('span');
        let summaryInfo = `${localeString} – ${calc.participants ? calc.participants.length : calc.names.length} people`;
        // Determine if advanced or simple
        const isAdvanced = calc.type === 'advanced' || calc.expenses !== undefined;
        let summaryCost;
        if (isAdvanced) {
          // Show total spent and number of expenses
          const totalSpent = calc.totalSpent || (calc.expenses || []).reduce((sum, exp) => sum + (exp.amount || 0), 0);
          summaryCost = `₹${totalSpent.toFixed(2)} total`;
        } else {
          const per = (calc.alcohol + calc.food) / calc.names.length;
          summaryCost = `₹${per.toFixed(2)}/person`;
        }
        summaryText.textContent = summaryInfo;
        const totalSpan = document.createElement('span');
        totalSpan.textContent = summaryCost;
        summary.appendChild(summaryText);
        summary.appendChild(totalSpan);
        // Details section
        const details = document.createElement('div');
        details.className = 'calculation-details';
        if (isAdvanced) {
          // Expenses list
          const expHeading = document.createElement('strong');
          expHeading.textContent = 'Expenses:';
          details.appendChild(expHeading);
          const expList = document.createElement('ul');
          expList.className = 'expense-list';
          (calc.expenses || []).forEach((exp) => {
            const liExp = document.createElement('li');
            const sharedWith = exp.sharedBy.join(', ');
            liExp.textContent = `${exp.description} – ₹${exp.amount.toFixed(2)} (paid by ${exp.payer}; shared by ${sharedWith})`;
            expList.appendChild(liExp);
          });
          details.appendChild(expList);
          // Net balances
          const netHeading = document.createElement('strong');
          netHeading.textContent = 'Balances:';
          details.appendChild(netHeading);
          const netList = document.createElement('ul');
          netList.className = 'net-list';
          const nets = calc.totals || [];
          nets.forEach((n) => {
            const liNet = document.createElement('li');
            if (Math.abs(n.net) < 0.01) {
              liNet.textContent = `${n.name}: Settled`;
            } else if (n.net > 0) {
              liNet.textContent = `${n.name} should receive ₹${n.net.toFixed(2)}`;
            } else {
              liNet.textContent = `${n.name} owes ₹${(-n.net).toFixed(2)}`;
            }
            netList.appendChild(liNet);
          });
          details.appendChild(netList);
          // Settlement recommendations
          if (calc.settlement && calc.settlement.length > 0) {
            const settleHeading = document.createElement('strong');
            settleHeading.textContent = 'Recommended payments:';
            details.appendChild(settleHeading);
            const settleList = document.createElement('ul');
            settleList.className = 'settlement-list';
            calc.settlement.forEach((st) => {
              const liSt = document.createElement('li');
              liSt.textContent = `${st.from} → ${st.to}: ₹${st.amount.toFixed(2)}`;
              settleList.appendChild(liSt);
            });
            details.appendChild(settleList);
          }
        } else {
          // Legacy equal-split details
          const perShare = (calc.alcohol + calc.food) / calc.names.length;
          const list = document.createElement('ul');
          list.className = 'net-list';
          calc.names.forEach((name) => {
            const liPerson = document.createElement('li');
            liPerson.textContent = `${name}: ₹${perShare.toFixed(2)}`;
            list.appendChild(liPerson);
          });
          details.appendChild(list);
        }
        // Attach toggle listener
        summary.addEventListener('click', () => {
          li.classList.toggle('open');
        });
        li.appendChild(summary);
        li.appendChild(details);
        calculationsList.appendChild(li);
      });
  }

  /**
   * Persist the current calculation into localStorage and refresh the
   * sidebar. After saving, the input fields are reset and a new blank
   * expense row is added for convenience.
   */
  function saveCalculation() {
    if (!lastCalculation) return;
    const calculations = JSON.parse(
      localStorage.getItem('darubuddy_calculations') || '[]'
    );
    calculations.push(lastCalculation);
    localStorage.setItem(
      'darubuddy_calculations',
      JSON.stringify(calculations)
    );
    renderCalculations();
    // Reset state and form
    lastCalculation = null;
    saveBtn.style.display = 'none';
    resultsContainer.innerHTML = '';
    namesContainer.innerHTML = '';
    expensesContainer.innerHTML = '';
    nameCount = 0;
    // Initialise with two participants and one expense row for a fresh start
    initializeNames(2);
    addExpense();
  }

  // Hook up event listeners
  addPersonBtn.addEventListener('click', () => addNameField());
  addExpenseBtn.addEventListener('click', addExpense);
  calculateBtn.addEventListener('click', calculateAdvanced);
  saveBtn.addEventListener('click', saveCalculation);

  // Initialise interface with default participants and one expense
  initializeNames(2);
  addExpense();
  // Render any previously saved calculations on load
  renderCalculations();
  // Update footer year automatically
  const yearEl = document.getElementById('currentYear');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
});