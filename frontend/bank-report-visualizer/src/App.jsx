import React, { useState } from 'react';
import { Upload, TrendingUp, TrendingDown, DollarSign, AlertCircle, FileText } from 'lucide-react';

const BankReportVisualizer = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_URL = 'http://localhost:8000';

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Errore nel caricamento del file');

      const data = await response.json();
      setPreview(data.preview);
      
      // Avvia automaticamente l'analisi
      analyzeFile(selectedFile);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const analyzeFile = async (fileToAnalyze) => {
    const formData = new FormData();
    formData.append('file', fileToAnalyze || file);

    try {
      const response = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Errore nell\'analisi del file');

      const data = await response.json();
      setReport(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            📊 Analizzatore Estratto Conto
          </h1>
          <p className="text-gray-600">Carica il tuo CSV ed ottieni un'analisi dettagliata delle spese</p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-12 cursor-pointer hover:border-indigo-500 transition-colors">
            <Upload className="w-16 h-16 text-gray-400 mb-4" />
            <span className="text-lg font-medium text-gray-700 mb-2">
              {file ? file.name : 'Clicca per caricare il CSV'}
            </span>
            <span className="text-sm text-gray-500">
              Formato: Data Registrazione, Data valuta, Descrizione, Importo (EUR)
            </span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8 flex items-center">
            <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
            <span className="text-red-700">{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Analisi in corso...</p>
          </div>
        )}

        {/* Preview Section */}
        {preview.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
              <FileText className="w-6 h-6 mr-2" />
              Anteprima Transazioni (Prime 10)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Data</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Descrizione</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Categoria</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-700">Importo</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((transaction, idx) => (
                    <tr key={idx} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">
                        {new Date(transaction['Data valuta']).toLocaleDateString('it-IT')}
                      </td>
                      <td className="px-4 py-3 text-gray-800">{transaction.Descrizione}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                          {transaction.Categoria}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${
                        transaction['Importo (EUR)'] >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(transaction['Importo (EUR)'])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Report Section */}
        {report && report.report_mensile && (
          <div className="space-y-8">
            {report.report_mensile.map((mese, idx) => (
              <div key={idx} className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-3xl font-bold text-gray-800 mb-6">
                  📅 {mese.mese}
                </h2>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-green-600 font-medium">Entrate</p>
                        <p className="text-2xl font-bold text-green-700">
                          {formatCurrency(mese.totale_entrate)}
                        </p>
                      </div>
                      <TrendingUp className="w-10 h-10 text-green-500" />
                    </div>
                  </div>

                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-red-600 font-medium">Uscite</p>
                        <p className="text-2xl font-bold text-red-700">
                          {formatCurrency(mese.totale_uscite)}
                        </p>
                      </div>
                      <TrendingDown className="w-10 h-10 text-red-500" />
                    </div>
                  </div>

                  <div className={`${
                    mese.saldo >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'
                  } rounded-lg p-4 border`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-sm font-medium ${
                          mese.saldo >= 0 ? 'text-blue-600' : 'text-orange-600'
                        }`}>Saldo</p>
                        <p className={`text-2xl font-bold ${
                          mese.saldo >= 0 ? 'text-blue-700' : 'text-orange-700'
                        }`}>
                          {formatCurrency(mese.saldo)}
                        </p>
                      </div>
                      <DollarSign className={`w-10 h-10 ${
                        mese.saldo >= 0 ? 'text-blue-500' : 'text-orange-500'
                      }`} />
                    </div>
                  </div>
                </div>

                {/* Categories Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {mese.dettaglio.Entrata && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-3">💰 Entrate per Categoria</h3>
                      <div className="space-y-2">
                        {mese.dettaglio.Entrata.map((cat, catIdx) => (
                          <div key={catIdx} className="bg-green-50 rounded p-3">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-medium text-gray-700">{cat.categoria}</span>
                              <span className="font-bold text-green-700">{formatCurrency(cat.importo)}</span>
                            </div>
                            <div className="w-full bg-green-200 rounded-full h-2">
                              <div
                                className="bg-green-500 h-2 rounded-full"
                                style={{ width: `${cat.percentuale}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-600">{cat.percentuale}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {mese.dettaglio.Uscita && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-3">💸 Uscite per Categoria</h3>
                      <div className="space-y-2">
                        {mese.dettaglio.Uscita.map((cat, catIdx) => (
                          <div key={catIdx} className="bg-red-50 rounded p-3">
                            <div className="flex justify-between items-center mb-1">
                              <span className="font-medium text-gray-700">{cat.categoria}</span>
                              <span className="font-bold text-red-700">{formatCurrency(cat.importo)}</span>
                            </div>
                            <div className="w-full bg-red-200 rounded-full h-2">
                              <div
                                className="bg-red-500 h-2 rounded-full"
                                style={{ width: `${cat.percentuale}%` }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-600">{cat.percentuale}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Non Categorizzate */}
            {report.non_categorizzate && report.non_categorizzate.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h3 className="text-xl font-bold text-yellow-800 mb-4 flex items-center">
                  <AlertCircle className="w-6 h-6 mr-2" />
                  ⚠️ Transazioni Non Categorizzate ({report.non_categorizzate.length})
                </h3>
                <div className="space-y-2">
                  {report.non_categorizzate.slice(0, 10).map((trans, idx) => (
                    <div key={idx} className="bg-white rounded p-3 flex justify-between items-center">
                      <div>
                        <span className="text-sm text-gray-600">
                          {new Date(trans['Data valuta']).toLocaleDateString('it-IT')}
                        </span>
                        <p className="font-medium text-gray-800">{trans.Descrizione}</p>
                      </div>
                      <span className="font-bold text-gray-700">
                        {formatCurrency(trans['Importo (EUR)'])}
                      </span>
                    </div>
                  ))}
                </div>
                {report.non_categorizzate.length > 10 && (
                  <p className="text-sm text-gray-600 mt-3">
                    ... e altre {report.non_categorizzate.length - 10} transazioni
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BankReportVisualizer;