
export const mapDrogToDTO=(drug: any)=>{
    return {
    id: drug.id,
    name: drug.name,
    genericName: drug.genericName,
    category: drug.category,
    price: drug.price,
    stock: drug.stock,
    minStockLevel: drug.minStockLevel,
    expiryDate: drug?.expiryDate,
    supplier: drug.supplier?.name || null,
  };
}