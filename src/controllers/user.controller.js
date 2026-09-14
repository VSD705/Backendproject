import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshToken = async(userId) => {
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}

    }catch(error){
        throw new ApiError(500, "Token generation failed")
    }
} 

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const {fullname, username, email, password} = req.body
    //console.log("email: ", email);

    if(
        [fullname, username, email, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const userExists = await User.findOne({
        $or: [{username}, {email}]
    })

    if(userExists) {
        throw new ApiError(409, "User with email or username already exists")
    }

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar is required")
    }

    let avatar;
    let coverImage;

    try {
        avatar = await uploadOnCloudinary(avatarLocalPath)
        coverImage = coverImageLocalPath
            ? await uploadOnCloudinary(coverImageLocalPath)
            : null
    } catch (error) {
        throw new ApiError(500, `Avatar upload failed: ${error.message}`)
    }

    if(!avatar?.url){
        throw new ApiError(500, "Avatar upload failed")
    }

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        username: username.toLowerCase(),
        email,
        password
    })

    const createdUser = await User.findById(user._id).select(
        "-_id -password -refreshToken -createdAt -updatedAt"
    )

    if(!createdUser){
        throw new ApiError(500, "User creation failed")
    }

    return res.status(201).json(
    new ApiResponse(200, createdUser, "User registered successfully")
    )
})

const loginUser = asyncHandler(async(req, res) => {
   // req body -> data
   //username or email
   //find the user
   //password check
   //access and refresh token generation
   //send cookie

   const {email,username,password} = req.body

   if(!username || !email){
         throw new ApiError(400, "Username or email is required")
   }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "User not found")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid User credentials")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200,{
            user: loggedInUser, accessToken, refreshToken
        },
        "User logged in successfully"
        )
    )
})

const logoutUser = asyncHandler(async(req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined

            }
        },
        {
            new: true
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }    

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User Logged out!"))
})

export { 
    registerUser,
    loginUser,
    logoutUser
}