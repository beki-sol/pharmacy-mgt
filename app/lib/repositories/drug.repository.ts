import { prisma } from "@/app/lib/prisma";
export class DrugRepository{
    // return by id 
    async findById(id: string){
        return prisma.drug.findUnique({
            where: {id: id,isActive: true},
            include: {supplier: {
                select: {name: true, company: true}
            }}
        });
    }
    // return user by bar code
    async findByBarCode(barcode: string){
        return prisma.drug.findUnique({
            where: {barcode: barcode}
        })
    }

    // find pagenated
    async findPaginated(where: any, options: any){
        const [drugs, total]= await Promise.all([
            prisma.drug.findMany({
                where, ...options
            }),
            prisma.drug.count({where})
        ])
        
        return {drugs,total};
        
    }

    // create
    async update(tx: any,id: string, data: any){
        return tx.drug.update({
            where: {id},
            data,
        });

        
    }
    // create
     async create(tx: any, data: any){
        return tx.drug.create({data})
     }

    async softDelete(tx: any, id: string){
        return tx.drug.update({
            where: {id},
            select: {isActive: false}

        })
    }


}