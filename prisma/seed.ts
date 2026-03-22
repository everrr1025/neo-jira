import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Clean data
  await prisma.issue.deleteMany()
  await prisma.iteration.deleteMany()
  await prisma.project.deleteMany()
  await prisma.user.deleteMany()

  // Hash common passwords
  const adminPassword = await bcrypt.hash('admin123', 10);
  const defaultPassword = await bcrypt.hash('password123', 10);

  // Create Users
  const user1 = await prisma.user.create({
    data: { name: 'Admin User', email: 'admin@neo-jira.local', role: 'ADMIN', password: adminPassword },
  })
  const user2 = await prisma.user.create({
    data: { name: 'Alice', email: 'alice@neo-jira.local', role: 'USER', password: defaultPassword },
  })
  const user3 = await prisma.user.create({
    data: { name: 'Bob', email: 'bob@neo-jira.local', role: 'USER', password: defaultPassword },
  })
  
  // Create Project
  const project = await prisma.project.create({
    data: {
      name: 'Neo-Jira Platform',
      key: 'NJ',
      description: 'The core project management platform.',
      ownerId: user1.id,
      members: {
        connect: [{ id: user1.id }, { id: user2.id }, { id: user3.id }]
      }
    },
  })

  // Create Iterations
  const sprint4 = await prisma.iteration.create({
    data: {
      name: 'Sprint 4',
      startDate: new Date(),
      endDate: new Date(new Date().setDate(new Date().getDate() + 14)),
      projectId: project.id,
      status: 'ACTIVE',
    },
  })
  
  const sprint5 = await prisma.iteration.create({
    data: {
      name: 'Sprint 5',
      startDate: new Date(new Date().setDate(new Date().getDate() + 14)),
      endDate: new Date(new Date().setDate(new Date().getDate() + 28)),
      projectId: project.id,
      status: 'PLANNED',
    },
  })

  // Create Issues
  await prisma.issue.create({
    data: {
      key: 'NJ-101',
      title: 'Design system component updates for the new navigation',
      status: 'TODO',
      type: 'TASK',
      priority: 'HIGH',
      projectId: project.id,
      iterationId: sprint4.id,
      assigneeId: user2.id,
      reporterId: user1.id,
    },
  })
  
  await prisma.issue.create({
    data: {
      key: 'NJ-102',
      title: 'Implement user authentication flow',
      status: 'IN_PROGRESS',
      type: 'STORY',
      priority: 'URGENT',
      projectId: project.id,
      iterationId: sprint4.id,
      assigneeId: user3.id,
      reporterId: user1.id,
    },
  })

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
