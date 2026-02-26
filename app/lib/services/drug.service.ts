import { prisma } from "@/app/lib/prisma";
import { DrugRepository } from "../repositories/drug.repository";
import { AppError } from "../utils/errors";
import { mapDrogToDTO } from "../dtos/drug.dto";

const repo = new DrugRepository();

export class DrugService {
  async getById(id: string, branchId: string) {
    const drug = await repo.findById(id);
    if (!drug) throw new AppError("Drug not found", 404);
    return mapDrogToDTO (drug);
  }
  async getDrugs(params: any) {
    const {
      page,
      limit,
      search,
      category,
      lowStock,
      expired,
      sortBy,
      sortOrder,
    } = params;

    const skip = (page - 1) * limit;

    let where: any = {
      isActive: true,
     
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { genericName: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category) where.category = category;

    if (expired === "true") {
      where.AND = [
        { expiryDate: { not: null } },
        { expiryDate: { lt: new Date() } },
      ];
    }

    const { drugs, total } = await repo.findPaginated(where, {
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    });

    return {
      drugs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async createDrug(data: any, session: any, request: any) {
   
    if (!["ADMIN", "PHARMACIST", "INVENTORY_MANAGER"].includes(session.user.role)) {
      throw new AppError("Insufficient permissions", 403);
    }

    if (data.barcode) {
      const existing = await repo.findByBarCode(data.barcode);
      if (existing) throw new AppError("Barcode already exists", 400);
    }

    return prisma.$transaction(async (tx) => {
      const newDrug = await repo.create(tx, {
        ...data,
        branchId: session.user.branchId,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      });

      await tx.inventoryLog.create({
        data: {
          drugId: newDrug.id,
          type: "PURCHASE",
          quantity: data.stock,
          previousStock: 0,
          newStock: data.stock,
          referenceType: "NEW_DRUG",
          userId: session.user.id,
        },
      });

      return mapDrogToDTO(newDrug);
    });
  }
   async update(id: string, data: any, session: any) {
    return prisma.$transaction(async (tx) => {

      const existing = await repo.findById(id);
      if (!existing) throw new AppError("Drug not found", 404);

      const updated = await repo.update(tx, id, {
        ...data,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entity: "Drug",
          entityId: id,
          newData: updated,
        },
      });

      return mapDrogToDTO(updated);
    });
  }

  async delete(id: string, session: any) {
    return prisma.$transaction(async (tx) => {

      const existing = await repo.findById(id);
      if (!existing) throw new AppError("Drug not found", 404);

      await repo.softDelete(tx, id);

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "DELETE",
          entity: "Drug",
          entityId: id,
        },
      });

      return { message: "Drug deleted successfully" };
    });
  }

  
}