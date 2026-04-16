interface ChapaInitParams {
  amount: number;
  currency: string;
  tx_ref: string;
  callback_url: string;
  return_url: string;
  email: string; 
  first_name?: string ;
  last_name?: string ;
  phone_number: string;
}

export async function initializeChapaPayment(params: ChapaInitParams) {
  const CHAPA_API_URL = 'https://api.chapa.co/v1/transaction/initialize';
  const CHAPA_SECRET_KEY = process.env.CHAPA_SECRET_KEY;

  try {
    const response = await fetch(CHAPA_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CHAPA_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await response.json();
    console.log("CHAPA RAW RESPONSE:", data);

    // Check the actual success field from Chapa
    if (data.status === 'success' && data.data?.checkout_url) {
      return {
        success: true,
        checkout_url: data.data.checkout_url,
        tx_ref: params.tx_ref,
      };
    } else {
      return {
        success: false,
        error: data.message || 'Chapa initialization failed',
      };
    }
  } catch (error: any) {
    console.error('Chapa API error:', error);
    return {
      success: false,
      error: error.message || 'Network or API error',
    };
  }
}