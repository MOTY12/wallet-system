import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, GetUserByIdDto } from './dto/user.dto';
import { User } from '@prisma/client';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    const { email, name } = createUserDto;

    this.logger.log(`Creating user with email: ${email}`);

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      this.logger.warn(`User with email ${email} already exists`);
      throw new BadRequestException('User with this email already exists');
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          name,
        },
      });

      this.logger.log(`User created successfully with id: ${user.id}`);
      return user;
    } catch (error) {
      this.logger.error(`Failed to create user: ${error.message}`, error);
      throw new BadRequestException('Failed to create user');
    }
  }

  async getUserById(getUserByIdDto: GetUserByIdDto): Promise<User> {
    const { userId } = getUserByIdDto;

    this.logger.debug(`Fetching user with id: ${userId}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      this.logger.warn(`User not found with id: ${userId}`);
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
