import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()

        if (error || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Obtener estadísticas del dashboard
        const [
            totalUsers,
            totalPosts,
            publishedPosts,
            recentPosts,
            userStats
        ] = await Promise.all([
            prisma.user.count(),
            prisma.post.count(),
            prisma.post.count({
                where: { published: true }
            }),
            prisma.post.findMany({
                take: 5,
                include: {
                    author: {
                        include: {
                            profile: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                }
            }),
            prisma.post.count({
                where: { authorId: user.id }
            })
        ])

        // Simular algunas métricas adicionales
        const stats = {
            totalUsers,
            totalPosts,
            publishedPosts,
            draftPosts: totalPosts - publishedPosts,
            userPosts: userStats,
            recentActivity: recentPosts.map((post: { id: string; title: string; author: { email: string }; createdAt: Date; published: boolean }) => ({
                id: post.id,
                title: post.title,
                author: post.author.email,
                createdAt: post.createdAt,
                published: post.published
            })),
            metrics: {
                engagementRate: Math.floor(Math.random() * 30) + 70, // 70-99%
                growthRate: Math.floor(Math.random() * 20) + 10,     // 10-29%
                satisfaction: Math.floor(Math.random() * 15) + 85    // 85-99%
            }
        }

        return NextResponse.json(stats)
    } catch (error) {
        console.error('Error fetching dashboard stats:', error)
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
