from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import pandas as pd
from datetime import datetime
from typing import List, Dict
import io

app = FastAPI(title="Bank Statement Analyzer API")

# Configurazione CORS per permettere richieste dal frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://localhost:5173",
        "http://127.0.0.1:5173"],  # Aggiungi altri origins se necessario
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dizionario di categorizzazione
CATEGORIE = {
    'Supermercato': ['esselunga', 'coop', 'carrefour', 'conad', 'lidl', 'eurospin', 'md', 'iper', 'pam', 'ekom', 'crai'],
    'Acquisti Casa': ['bricofer', 'action', 'risparmio casa'],
    'Ristoranti': ['ristorante', 'pizzeria', 'bar', 'trattoria', 'osteria', 'mcdonald', 'burger king', 'kfc', 'gelateria', 'cream', 'rosso di sera', 'akiko'],
    'Trasporti': ['carburanti','petroli','trenitalia', 'italo', 'atm', 'uber', 'taxi', 'eni', 'q8', 'agip', 'carburante', 'benzina', 'tap', 'aspit', 'torino piacenza', 
                  'a21', 'parma'],
    'Utenze': ['enel', 'eni gas', 'a2a', 'telecom', 'tim', 'vodafone', 'wind', 'iliad', 'fastweb'],
    'Shopping': ['amazon', 'zara', 'h&m', 'decathlon', 'ikea', 'mediaworld', 'unieuro', 'ishue'],
    'Salute': ['farmacia', 'medico', 'dentista', 'ospedale', 'clinica', 'poliambulatorio'],
    'Affitto': ['affitto', 'canone'],
    'Abbonamenti': ['netflix', 'spotify', 'disney', 'prime', 'abbonamento', 'palestra', 'orange'],
    'Banca': ['commissione', 'imposta bollo', 'canone', 'interessi'],
    'Stipendio': ['stipendio', 'accredito stipendio', 'emolumento', 'salario', 'emolumenti'],
    'Bonifici': ['bonifico'],
    'Paypal' : ['paypal'],
    'GooglePay': ['google'],
    'Viaggi': ['soggiorno']
}

def categorizza_transazione(descrizione: str, importo: float) -> tuple:
    """Categorizza una transazione basandosi sulla descrizione."""
    descrizione_lower = descrizione.lower()
    tipo = 'Entrata' if importo > 0 else 'Uscita'
    
    for categoria, parole_chiave in CATEGORIE.items():
        for parola in parole_chiave:
            if parola in descrizione_lower:
                return categoria, tipo
    
    return 'Altro', tipo

def processa_csv(file_content: bytes) -> pd.DataFrame:
    """Processa il contenuto del CSV e restituisce un DataFrame."""
    try:
        # Prova diversi formati
        df = pd.read_csv(io.BytesIO(file_content), sep=';', decimal=',',thousands='.', encoding='utf-8').dropna(axis=1, how='all')
    except:
        try:
            df = pd.read_csv(io.BytesIO(file_content), sep=';', decimal=',', encoding='latin-1')
        except:
            df = pd.read_csv(io.BytesIO(file_content), sep=',', quotechar='"', encoding='utf-8')
    
    # Pulisci i nomi delle colonne
    df.columns = df.columns.str.strip()

    # Debug: stampa le colonne trovate
    print(f"Colonne trovate: {df.columns.tolist()}")
    print(f"Prime righe del file:\n{df.head()}\n")

    # Converti la data valuta
    df['Data valuta'] = pd.to_datetime(df['Data valuta'], dayfirst=True)
    
    # Converti l'importo se è stringa
    if df['Importo (EUR)'].dtype == 'object':
        df['Importo (EUR)'] = df['Importo (EUR)'].str.replace('.', '').str.replace(',', '.').astype(float)
    
    # Aggiungi mese
    df['Mese'] = df['Data valuta'].dt.to_period('M').astype(str)
    
    # Categorizza
    df['Categoria'], df['Tipo'] = zip(*df.apply(
        lambda row: categorizza_transazione(row['Descrizione'], row['Importo (EUR)']), 
        axis=1
    ))
    
    return df

@app.get("/")
async def root():
    return {"message": "Bank Statement Analyzer API", "version": "1.0"}

@app.post("/upload")
async def upload_csv(file: UploadFile = File(...)):
    """
    Upload e analisi del file CSV.
    Restituisce i dati delle transazioni e le prime righe per preview.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Il file deve essere un CSV")
    
    try:
        content = await file.read()
        df = processa_csv(content)
        
        # Converti in formato JSON-friendly
        transactions = df.to_dict('records')
        
        # Converti le date in stringhe
        for t in transactions:
            if isinstance(t['Data valuta'], pd.Timestamp):
                t['Data valuta'] = t['Data valuta'].strftime('%Y-%m-%d')
        
        return {
            "success": True,
            "total_transactions": len(df),
            "transactions": transactions,
            "preview": transactions[:10],  # Prime 10 transazioni per preview
            "columns": df.columns.tolist()
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nel processare il file: {str(e)}")

@app.post("/analyze")
async def analyze_transactions(file: UploadFile = File(...)):
    """
    Analizza il CSV e restituisce il report mensile strutturato.
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Il file deve essere un CSV")
    
    try:
        content = await file.read()
        df = processa_csv(content)
        
        # Genera report per ogni mese
        report_mensile = []
        
        for mese in sorted(df['Mese'].unique()):
            df_mese = df[df['Mese'] == mese]
            
            # Totali generali
            totale_entrate = float(df_mese[df_mese['Tipo'] == 'Entrata']['Importo (EUR)'].sum())
            totale_uscite = float(abs(df_mese[df_mese['Tipo'] == 'Uscita']['Importo (EUR)'].sum()))
            saldo = totale_entrate - totale_uscite
            
            # Dettaglio per tipo e categoria
            dettaglio = {}
            
            for tipo in ['Entrata', 'Uscita']:
                df_tipo = df_mese[df_mese['Tipo'] == tipo]
                if not df_tipo.empty:
                    totale_tipo = float(abs(df_tipo['Importo (EUR)'].sum()))
                    per_categoria = df_tipo.groupby('Categoria')['Importo (EUR)'].sum().abs()
                    
                    categorie_list = []
                    for categoria, importo in per_categoria.items():
                        importo_float = float(importo)
                        percentuale = (importo_float / totale_tipo * 100) if totale_tipo > 0 else 0
                        categorie_list.append({
                            'categoria': categoria,
                            'importo': round(importo_float, 2),
                            'percentuale': round(percentuale, 1)
                        })
                    
                    # Ordina per importo decrescente
                    categorie_list.sort(key=lambda x: x['importo'], reverse=True)
                    dettaglio[tipo] = categorie_list
            
            report_mensile.append({
                'mese': mese,
                'totale_entrate': round(totale_entrate, 2),
                'totale_uscite': round(totale_uscite, 2),
                'saldo': round(saldo, 2),
                'dettaglio': dettaglio,
                'numero_transazioni': len(df_mese)
            })
        
        # Transazioni non categorizzate
        df_altro = df[df['Categoria'] == 'Altro']
        non_categorizzate = df_altro[['Data valuta', 'Descrizione', 'Importo (EUR)']].to_dict('records')
        
        for t in non_categorizzate:
            if isinstance(t['Data valuta'], pd.Timestamp):
                t['Data valuta'] = t['Data valuta'].strftime('%Y-%m-%d')
        
        return {
            "success": True,
            "report_mensile": report_mensile,
            "non_categorizzate": non_categorizzate,
            "totale_transazioni": len(df)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nell'analisi: {str(e)}")

@app.get("/categorie")
async def get_categorie():
    """Restituisce l'elenco delle categorie configurate."""
    return {
        "categorie": list(CATEGORIE.keys()),
        "dettaglio": CATEGORIE
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)