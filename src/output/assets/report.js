/**
 * Client-side logic for AI Stock Predictions Report
 * Handles chart initialization and dashboard sorting
 */

(() => {
	/**
	 * Sorting functionality for the dashboard table
	 * @param {number} columnIndex - The index of the column to sort by
	 */
	globalThis.sortTable = (columnIndex) => {
		const table = document.querySelector('#dashboard-table');
		if (!table) return;

		const tbody = table.tBodies[0];
		const rows = [...tbody.rows];
		const isNumeric = [2, 3, 4, 5].includes(columnIndex);
		const currentDirection = table.dataset.sortDir === 'asc' ? 'desc' : 'asc';
		const direction = currentDirection === 'asc' ? 1 : -1;

		rows.sort((a, b) => {
			const cellA = a.cells[columnIndex].textContent.trim();
			const cellB = b.cells[columnIndex].textContent.trim();

			if (isNumeric) {
				const valueA = Number.parseFloat(cellA.replaceAll(/[^0-9.-]/g, '')) || 0;
				const valueB = Number.parseFloat(cellB.replaceAll(/[^0-9.-]/g, '')) || 0;
				return direction * (valueA - valueB);
			}
			return direction * cellA.localeCompare(cellB);
		});

		table.dataset.sortDir = currentDirection;
		while (tbody.firstChild) tbody.firstChild.remove();
		for (const row of rows) tbody.append(row);
	};

	/**
	 * Initialize a chart for a specific symbol
	 * @param {string} symbol - Stock symbol
	 * @param {object} data - Chart data
	 */
	globalThis.initCharts = (symbol, data) => {
		// Backtest Equity Curve Chart
		const backtestContext = document.querySelector(`#chart-backtest-${symbol}`);
		if (backtestContext && data.backtest) {
			new Chart(backtestContext, {
				type: 'line',
				data: {
					labels: data.backtest.labels,
					datasets: [
						{
							label: 'Portfolio Value ($)',
							data: data.backtest.values,
							borderColor: '#28a745',
							backgroundColor: 'rgba(40, 167, 69, 0.1)',
							borderWidth: 2,
							pointRadius: 0,
							fill: true,
							tension: 0.1,
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					interaction: {intersect: false, mode: 'index'},
					scales: {
						y: {
							beginAtZero: false,
							ticks: {
								callback: (value) => `$${Number(value).toLocaleString()}`,
							},
						},
					},
				},
			});
		}

		// Full History Chart
		const historyContext = document.querySelector(`#chart-history-${symbol}`);
		if (historyContext) {
			new Chart(historyContext, {
				type: 'line',
				data: {
					labels: data.history.labels,
					datasets: [
						{
							label: 'Actual Price',
							data: data.history.prices,
							borderColor: '#6c757d',
							backgroundColor: 'rgba(108, 117, 125, 0.1)',
							borderWidth: 1,
							pointRadius: 0,
							fill: true,
							tension: 0.1,
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					interaction: {intersect: false, mode: 'index'},
					plugins: {legend: {display: false}},
					scales: {x: {display: false}, y: {beginAtZero: false}},
				},
			});
		}

		// Prediction Chart
		const predictionContext = document.querySelector(`#chart-prediction-${symbol}`);
		if (predictionContext) {
			const {signalRgb, signalColor} = data.prediction;

			new Chart(predictionContext, {
				type: 'line',
				data: {
					labels: data.prediction.labels,
					datasets: [
						{
							label: 'Recent Actual',
							data: data.prediction.actualDataset,
							borderColor: '#6c757d',
							backgroundColor: 'transparent',
							borderDash: [5, 5],
							borderWidth: 2,
							pointRadius: 2,
							tension: 0.1,
							spanGaps: false,
						},
						{
							label: '95% Upper Bound',
							data: data.prediction.upperDataset,
							borderColor: `rgba(${signalRgb}, 0.3)`,
							borderWidth: 1,
							borderDash: [2, 2],
							pointRadius: 0,
							fill: false,
							tension: 0.1,
							spanGaps: false,
						},
						{
							label: '95% Lower Bound',
							data: data.prediction.lowerDataset,
							borderColor: `rgba(${signalRgb}, 0.3)`,
							borderWidth: 1,
							borderDash: [2, 2],
							pointRadius: 0,
							fill: '-1',
							backgroundColor: `rgba(${signalRgb}, 0.1)`,
							tension: 0.1,
							spanGaps: false,
						},
						{
							label: 'Forecast (Mean)',
							data: data.prediction.predictedDataset,
							borderColor: signalColor,
							backgroundColor: `rgba(${signalRgb}, 0.15)`,
							borderWidth: 3,
							pointRadius: 3,
							fill: true,
							tension: 0.1,
							spanGaps: false,
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					interaction: {intersect: false, mode: 'index'},
					scales: {
						y: {beginAtZero: false},
						x: {ticks: {maxRotation: 45, minRotation: 45}},
					},
				},
			});
		}
	};
})();
