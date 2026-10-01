import React, {useState} from "react";
import "./Example.css";


const Example = () => {

	const [input1, onChangeInput1] = useState('');
	const [input2, onChangeInput2] = useState('');
	const [input3, onChangeInput3] = useState('');
	const [input4, onChangeInput4] = useState('');
	const [input5, onChangeInput5] = useState('');
	const [input6, onChangeInput6] = useState('');
	const [input7, onChangeInput7] = useState('');
	const [input8, onChangeInput8] = useState('');
	const [input9, onChangeInput9] = useState('');
	const [input10, onChangeInput10] = useState('');
	const [input11, onChangeInput11] = useState('');
	const [input12, onChangeInput12] = useState('');
	const [showDatePicker, setShowDatePicker] = useState(false);
	const [selectedDateRange, setSelectedDateRange] = useState(null);



	return (

	<div className="contain">
			<div className="scroll-view">
				

				<div className="row-view">
					<span className="text" >
						{"Add new Client"}
					</span>
					<div className="box">
					</div>
				</div>
				<div className="row-view2">
					<span className="text2" >
						{"Corporate Details"}
					</span>
					<div className="box2">
					</div>
					<span className="text3" >
						{"Billing Details"}
					</span>
					<div className="box2">
					</div>
					<span className="text4" >
						{"Review Changes"}
					</span>
				</div>
				<div className="column">
					<div className="row-view3">
						<div className="row-view4">
							<img
								src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/20xzpgquYu/p10wr5bj_expires_30_days.png"}
								className="image"
							/>
							<span className="text5" >
								{"Profile Photo"}
							</span>
						</div>
						<button className="button-row-view"
							onClick={()=>alert("Pressed!")}>
							<span className="text6" >
								{"Upload Photo"}
							</span>
							<img
								src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/20xzpgquYu/vb14dn52_expires_30_days.png"}
								className="image2"
							/>
						</button>
					</div>
					<div className="column2">
						<div className="row-view5">
							<div className="column3">
								<span className="text7" >
									{"First Name *"}
								</span>
								<input
									placeholder={"First Name"}
									value={input1}
									onChange={(event)=>onChangeInput1(event.target.value)}
									className="input"
								/>
							</div>
							<div className="column4">
								<div className="view">
									<span className="text8" >
										{"Client/Lead"}
									</span>
								</div>
								<button className="button-row-view2"
									onClick={()=>alert("Pressed!")}>
									<span className="text9" >
										{"Select type"}
									</span>
									<img
										src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/20xzpgquYu/bjbjxtea_expires_30_days.png"}
										className="image3"
									/>
								</button>
							</div>
							<div className="column4">
								<div className="view">
									<span className="text8" >
										{"Cargo Type"}
									</span>
								</div>
								<button className="button-row-view2"
									onClick={()=>alert("Pressed!")}>
									<span className="text10" >
										{"Bulk Cargo"}
									</span>
									<img
										src={"https://storage.googleapis.com/tagjs-prod.appspot.com/v1/20xzpgquYu/ugs7yg0q_expires_30_days.png"}
										className="image3"
									/>
								</button>
							</div>
						</div>
						<div className="row-view5">
							<div className="column3">
								<span className="text7" >
									{"First Name *"}
								</span>
								<input
									placeholder={"|"}
									value={input2}
									onChange={(event)=>onChangeInput2(event.target.value)}
									className="input2"
								/>
							</div>
							<div className="column3">
								<span className="text7" >
									{"First Name *"}
								</span>
								<input
									placeholder={"First Name"}
									value={input3}
									onChange={(event)=>onChangeInput3(event.target.value)}
									className="input"
								/>
							</div>
							<div className="column3">
								<span className="text7" >
									{"First Name *"}
								</span>
								<input
									placeholder={"First Name"}
									value={input4}
									onChange={(event)=>onChangeInput4(event.target.value)}
									className="input"
								/>
							</div>
						</div>
						<div className="row-view5">
							<div className="column3">
								<span className="text7" >
									{"First Name *"}
								</span>
								<input
									placeholder={"First Name"}
									value={input5}
									onChange={(event)=>onChangeInput5(event.target.value)}
									className="input"
								/>
							</div>
							<div className="column3">
								<span className="text7" >
									{"First Name *"}
								</span>
								<input
									placeholder={"First Name"}
									value={input6}
									onChange={(event)=>onChangeInput6(event.target.value)}
									className="input"
								/>
							</div>
							<div className="column3">
								<span className="text7" >
									{"First Name *"}
								</span>
								<input
									placeholder={"First Name"}
									value={input7}
									onChange={(event)=>onChangeInput7(event.target.value)}
									className="input"
								/>
							</div>
						</div>
						<div className="row-view5">
							<div className="column3">
								<span className="text7" >
									{"First Name *"}
								</span>
								<input
									placeholder={"First Name"}
									value={input8}
									onChange={(event)=>onChangeInput8(event.target.value)}
									className="input"
								/>
							</div>
							<div className="column3">
								<span className="text7" >
									{"First Name *"}
								</span>
								<input
									placeholder={"First Name"}
									value={input9}
									onChange={(event)=>onChangeInput9(event.target.value)}
									className="input"
								/>
							</div>
							<div className="column3">
								<span className="text7" >
									{"First Name *"}
								</span>
								<input
									placeholder={"First Name"}
									value={input10}
									onChange={(event)=>onChangeInput10(event.target.value)}
									className="input"
								/>
							</div>
						</div>
					</div>
				</div>
				<div className="row-view6">
					<button className="button"
						onClick={()=>alert("Pressed!")}>
						<span className="text11" >
							{"Prev"}
						</span>
					</button>
					<button className="button2"
						onClick={()=>alert("Pressed!")}>
						<span className="text12" >
							{"Next"}
						</span>
					</button>
				</div>
			</div>
		</div>

	);
};

export default Example;
