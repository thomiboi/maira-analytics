import { NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

// Helper to serialize BigInt
const replacer = (key: string, value: unknown) =>
    typeof value === "bigint" ? value.toString() : value; export async function GET(request: Request) {
        try {
            const { searchParams } = new URL(request.url);
            const limit = parseInt(searchParams.get("limit") || "50");
            const offset = parseInt(searchParams.get("offset") || "0");
            const search = searchParams.get("search") || "";
            const alertsOnly = searchParams.get("alerts_only") === "true";

            const where: Prisma.productos_posWhereInput = { activo: true };

            if (search) {
                where.OR = [
                    { nombre: { contains: search, mode: "insensitive" as const } },
                    { codigo: { contains: search, mode: "insensitive" as const } },
                ];
            }

            if (alertsOnly) {
                where.stock_minimo = { some: {} };
            }

            const [products, total] = await Promise.all([
                prisma.productos_pos.findMany({
                    where,
                    take: limit,
                    skip: offset,
                    include: {
                        stock_minimo: true,
                    },
                    orderBy: { nombre: "asc" },
                }),
                prisma.productos_pos.count({ where }),
            ]); return new NextResponse(JSON.stringify({ success: true, products, total }, replacer), {
                headers: { "Content-Type": "application/json" },
            });
        } catch (error) {
            console.error("Error fetching products:", error);
            return NextResponse.json(
                { success: false, error: "Error fetching products" },
                { status: 500 }
            );
        }
    }

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { producto_id, bodega_id, stock_minimo } = body;

        if (!producto_id || !bodega_id || stock_minimo === undefined) {
            return NextResponse.json(
                { success: false, error: "Missing required fields" },
                { status: 400 }
            );
        }

        const result = await prisma.stock_minimo.upsert({
            where: {
                producto_id_bodega_id: {
                    producto_id: BigInt(producto_id),
                    bodega_id: BigInt(bodega_id),
                },
            },
            update: {
                stock_minimo: parseFloat(stock_minimo),
            },
            create: {
                producto_id: BigInt(producto_id),
                bodega_id: BigInt(bodega_id),
                stock_minimo: parseFloat(stock_minimo),
            },
        });

        return new NextResponse(JSON.stringify({ success: true, data: result }, replacer), {
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("Error updating stock alert:", error);
        return NextResponse.json(
            { success: false, error: "Error updating stock alert" },
            { status: 500 }
        );
    }
}
