import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Seeding database...')

    // Clear existing data
    await prisma.orderItem.deleteMany()
    await prisma.order.deleteMany()
    await prisma.dish.deleteMany()
    await prisma.user.deleteMany()
    await prisma.aIInstruction.deleteMany()

    // Create Dishes
    const dishes = await Promise.all([
        prisma.dish.create({
            data: {
                name: 'Тартар из лосося',
                description: 'Свежий лосось с авокадо, каперсами и соусом манго-чили.',
                price: 850,
                category: 'Закуски',
                imageUrl: 'https://images.unsplash.com/photo-1546039907-7fa05f864c02?auto=format&fit=crop&q=80&w=800',
                allergens: ['Рыба'],
            },
        }),
        prisma.dish.create({
            data: {
                name: 'Борщ с говядиной',
                description: 'Традиционный домашний борщ со сметаной и чесночными пампушками.',
                price: 550,
                category: 'Супы',
                imageUrl: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=800',
                allergens: ['Лактоза', 'Глютен'],
            },
        }),
        prisma.dish.create({
            data: {
                name: 'Стейк Рибай',
                description: 'Премиальная говядина прожарки Medium, подается с овощами гриль.',
                price: 2400,
                category: 'Горячее',
                imageUrl: 'https://images.unsplash.com/photo-1546241072-48010ad2882c?auto=format&fit=crop&q=80&w=800',
                allergens: [],
            },
        }),
        prisma.dish.create({
            data: {
                name: 'Паста Карбонара',
                description: 'Классическая паста с беконом, пармезаном и яичным желтком.',
                price: 720,
                category: 'Горячее',
                imageUrl: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&fit=crop&q=80&w=800',
                allergens: ['Глютен', 'Лактоза', 'Яйцо'],
            },
        }),
        prisma.dish.create({
            data: {
                name: 'Чизкейк Нью-Йорк',
                description: 'Нежный сливочный чизкейк с ягодным соусом.',
                price: 450,
                category: 'Десерты',
                imageUrl: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&q=80&w=800',
                allergens: ['Лактоза', 'Глютен'],
            },
        }),
    ])

    // Create Users (Admin & Waiter)
    await prisma.user.create({
        data: {
            email: 'admin@qrmenu.com',
            passwordHash: 'hashed_password', // In real app, hash this properly
            role: 'ADMIN',
            name: 'Owner',
        },
    })

    await prisma.user.create({
        data: {
            email: 'waiter1@qrmenu.com',
            passwordHash: 'hashed_password',
            role: 'WAITER',
            name: 'Ivan',
            pinCode: '1234',
        },
    })

    // Create AI Instructions
    await prisma.aIInstruction.create({
        data: {
            promptText: 'Ты помощник официанта Claude. Рекомендуй блюда вежливо. Мы сегодня активно предлагаем Тартар из лосося. После 23:00 не предлагаем алкоголь.',
            isActive: true,
            version: 1,
        },
    })

    console.log('✅ Seeding completed!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
