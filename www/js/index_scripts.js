/*global Image: false, document: false, intel: false, localStorage: false, $: false, console: false */

(function () {
    "use strict";
	
	//the pin number secure data instance.
	var extraKeySD = null;
	
	var unavailableItem = 0;
	var itemNotSecured = null;
	
	/**********************************************************************************************/
    //single point of failure for all API calls in this sample, for more information on
    //the error object, consult with Intel App Security API documentation.
    /**********************************************************************************************/
    function fail(errObj) {
		console.error('Error Code: ' + errObj.code + ' Error message: ' + errObj.message);
    }
	
    /*******************************************************************************************/
    //this function updates the "itemsList" with items in secureStorage, it then updates the 
	//listview to show the updated list.
    /*******************************************************************************************/
    function loadItemsFromStorage() {
        var storageIdList = JSON.parse(localStorage.getItem('itemsList'));
        //go over each item existing in secureStorage and load it.
        $.each
            (storageIdList, function (itemID, item) {
				if (isItemSecured(item)) {   
					//here we read the secureStorage object corresponding to the given itemID.               
					intel.security.secureStorage.read(function (instanceID) {
						//Success callback, the secureStorage object was read successfully.
						//a secureData object was created, now we get it's tag string.
						intel.security.secureData.getTag(function (itemTags) {
							//Success callback the Tag string was extracted successfully,
							//update internal structures and the listview
							item.instanceID = instanceID;
							item.tag = itemTags;							
							updateItemsList(itemID, item);
							updateListView(itemID, item);
						}, fail, instanceID);
					}, function(errorObj) {
						if (errorObj.message === 'Data integrity violation detected')
						{
							//item not availabe, wrong PIN number
							item.instanceID = unavailableItem;
							updateItemsList(itemID, item);
							updateListView(itemID, item);
						}
						fail();					
					}, { 'id': itemID, 'extraKey': extraKeySD });
				}
				else{
					 updateListView(itemID, item);
				}
		});
		
    }
	
    /****************************************************************************************/
    //create a new secure Item from the input data using APP Security API.
	//it updates the items list and the listview accordingly
    /****************************************************************************************/
    function createNewSecureItem(itemID, itemTags, itemData) {
        //secure the data by creating a secureData object, the data and tag string are passed
        //as parameters
        intel.security.secureData.createFromData(function (instanceID) {
            //this is the success callback, a secureData object was created,
            //next we want to secure the object in secure storage.
            intel.security.secureStorage.writeSecureData(function () {
                //this is the success callback, secureData object was stored in secure storage,
                //update the internal data structures and update the listview.
                isValidImageUrl(itemData, function () {
                    //item is an image
					var newItem = { 'instanceID': instanceID, 'tag': itemTags, 'item_text': itemData, 'isImage': true };
					updateItemsList(itemID, newItem);
					updateListView(itemID, newItem);
                }, function () {
                    //item is plain-text
					var newItem = { 'instanceID': instanceID, 'tag': itemTags, 'item_text': itemData, 'isImage': false};
					updateItemsList(itemID, newItem);
					updateListView(itemID, newItem);
                });
            }, fail, { 'id': itemID, 'instanceID': instanceID });
        }, fail, { 'data': itemData, 'tag': itemTags, 'extraKey':extraKeySD });
    }
	
	/****************************************************************************************/
    //create a new unsecure Item from the input data.
	//it updates the items list and the listview accordingly
    /****************************************************************************************/
	function createNewUnsecureItem(itemID, itemsTags, itemData)
	{
			isValidImageUrl(itemData, function () {
				//item is an image
				var newItem = { 'instanceID': itemNotSecured, 'tag': itemsTags, 'item_text': itemData, 'isImage': true};
				updateItemsList(itemID, newItem);
				updateListView(itemID, newItem);
			}, function () {
            	//item is plain-text
				var newItem = { 'instanceID': itemNotSecured, 'tag': itemsTags, 'item_text': itemData, 'isImage': false};
				updateItemsList(itemID, newItem);
				updateListView(itemID, newItem);
            });
	}
    /***********************************************************************************************/
    //"itemsList" is a map object which holds the collection items currently in the app.
    /**********************************************************************************************/
    function updateItemsList(itemID, item) {
        var items = JSON.parse(localStorage.getItem('itemsList'));
		
		//for seucred items we want to dispose of the plain-text data.
		if (isItemSecured(item))
		{
			item.item_text = '';
		}
		//old item will be overwritten
        items[itemID] = item;
        localStorage.setItem('itemsList', JSON.stringify(items));
    }
	
	/**********************************************************************************************/
    //this function adds an item to the application listview
    /**********************************************************************************************/	
    function updateListView(itemID, item) {
        var listElem = $('<li><a id="' + itemID +
                        '" href="#item_page_popup" data-position-to="window" data-rel="popup"' +
                         ' data-theme="b" class="list_elem ui-btn ui-btn-b" data-transition="slide" ' +
                         'data-position-to="window" data-direction="reverse"><h3>' +
                                itemID + '</h3><p>Tags: ' + item.tag + '</p></a></li>');
        if (isItemSecured(item)) {
        	listElem.find('a').addClass('ui-icon-lock ui-btn-icon-right');
			if (item.instanceID == unavailableItem)
			{
				listElem.find('a').addClass('redLock');
			}
			else
			{
				listElem.find('a').addClass('greenLock');
			}
        }
        listElem.click(function(){
            //set id and tags for the selected item
            $('#item_id').text(itemID);
			$('#item_tag').css({ 'font-weight':'bold', 'color':'black'});
			$('#item_tag').text('Tags: ' + item.tag);

			//is item not secured
            if (!(isItemSecured(item))) {
               	if (item.isImage === true) {
					$('#item_data').hide();
                   	$('#item_image').attr('src', item.item_text);
					$('#item_image').show();
               	}
               	else {
					//this is a text item so show the text element and hide the image element
					$('#item_data').show();
					$('#item_image').hide();
					$('#item_data').text(item.item_text);
				}
				//show the button
				$('#show_item_button').show();
				$('#show_item_button').text("Secure");
				$('#show_item_button').buttonMarkup({ icon: "lock" });
			}
			else {
				$('#show_item_button').hide();
				if (item.instanceID === unavailableItem)
				{
					$('#item_image').attr('src', 'images/lock-it.png');
					$('#item_image').show();
					$('#item_tag').text('Wrong PIN number');
					$('#item_tag').css({ 'font-weight':'bold', 'color':'red'});
					$('#item_data').hide();
				}
				else
				{
					intel.security.secureData.getData(function (itemData) {
						if (item.isImage === true) {
							$('#item_data').hide();
							$('#item_image').show();
							$('#item_image').attr('src', itemData);
						}
						else {
							//item is a text item						
							$('#item_image').hide(); 
							$('#item_data').text(itemData);
							$('#item_data').show();                       
						}
					},
					fail, item.instanceID);
				}
				
			}	
		});
		listElem.prependTo('#items_list');
		$('#items_list').children().next().hide();
		$('#items_list').children().next().slideDown('slow');
    }
	
	/**********************************************************************************************/
    //remove item from listView
    /**********************************************************************************************/
	function removeItemFromListView(itemID){
		$("#" + itemID).parent().remove();
		$('#items_list').children().next().hide();
		$('#items_list').children().next().slideDown('slow');
	}
	
    /**********************************************************************************************/
    //event handlers
    /**********************************************************************************************/
    function register_event_handlers() {
        $(document).on("click", "#save_item", function (evt) {
			
			//check inputs
			if ($('#new_item_id').val() === ""){
				$('#new_item_id').attr("placeholder", "Item Id field is required");
				$('#new_item_id').parent().css('border-color','red');
				return;
			}
			if($('#new_item_id').val().indexOf(" ") > -1)
			{
				$('#new_item_id').parent().css('border-color','red');
				$('#new_item_id').val("");
				$('#new_item_id').attr("placeholder", "Item Id can't contain spaces");
				return;
			}
			var itemID = $('#new_item_id').val();
			if ($('#new_item_text').val() === ""){
				$('#new_item_text').attr("placeholder", "Item data is required");	
				$('#new_item_text').css('border-color','red');
				return;
			}            
			//if an item with the id exists then dont add the new item.
			var items = JSON.parse(localStorage.getItem('itemsList'));
			if (itemID in items){
				$('#new_item_id').val("");
				$('#new_item_id').attr("placeholder", "Item ID exists");
				$('#new_item_id').parent().css('border-color','red');
				return;
			}
			$('#new_item_popup').popup("close");
			var itemTag = $('#new_item_tag').val();
            if ($('#secure_item').val() === 'on') {
                createNewSecureItem(itemID, itemTag, $('#new_item_text').val());
                clearNewItemPage();
            }
            else {
				//item is not secured
				createNewUnsecureItem(itemID, itemTag, $('#new_item_text').val());  
				clearNewItemPage();
            }
        });
		
        /***************************************************************************************/
        //callback code for the secure item button
        /***************************************************************************************/
        $(document).on("click", "#show_item_button", function (evt) {
            var itemID = $('#item_id').text();
            var items = JSON.parse(localStorage.getItem('itemsList'));
            var item = items[itemID];
			//assert item is not secured
            if (!(isItemSecured(item))) {
				//secure it
				removeItemFromListView(itemID);
                delete items[itemID];
                localStorage.setItem('itemsList', JSON.stringify(items));
                createNewSecureItem(itemID, item.tag, item.item_text, item.isImage);
                $('#item_page_popup').popup("close");
                
            }
        });
		
	  $(document).on("click", "#signin", function (evt) {		 
		 $('#pinInput').parent().css('border-color','');
		 if ($('#pinInput').val().length < 4)
		 {
			$('#pinInput').val('');
			$('#pinInput').parent().css('border-style','solid');
		 	$('#pinInput').parent().css('border-width', 'medium');
			$('#pinInput').parent().css('border-color','red');
		 }
		 else
		 {
			 intel.security.secureData.createFromData(function (instanceID) {
				 $('#pinInput').val('');
				 extraKeySD = instanceID;
				 $.mobile.changePage($("#items"), "none");
			 }, fail, { 'data': $('#pinInput').val(), 'noRead': true, 'noStore':true });
		 }
		  
		 return false;
	  });
		
	$(document).on("click", "#back_button", function (evt) {
		
		var itemsList = JSON.parse(localStorage.getItem('itemsList'));
		$.each
            (itemsList, function (itemID, item) {
				if (isItemSecured(item) && item.instanceID !== unavailableItem) {   
					intel.security.secureData.destroy(null, fail, item.instanceID);	
				}
		});
		//remove extraKey secure data instance
		intel.security.secureData.destroy(null, fail, extraKeySD);
		extraKeySD = null;
		$.mobile.changePage($("#mainpage"), "none");
		return false;
	  });
		
		$('#items').bind('pagebeforeshow', function() {
			//empty the listview
			var list = $('#items_list');
			list.empty();
			if (!('itemsList' in localStorage)) {
				var storageIdList = {};
				localStorage.setItem('itemsList', JSON.stringify(storageIdList));
				loadDefaultItems();
			}
			else {
				//load all item stored in secure storage and update the listView
				//with the loaded items.
				loadItemsFromStorage();
			}
		});
		//add event callbacks
		$("#item_page_popup").bind({
			popupafterclose: function (event, ui) {
				$('#show_item_button').show();
				$('#show_item_button').text('Show');
				$('#item_data').val('');
				$('#item_image').attr('src', 'images/lock-it.png');
			}
		});
		//swipe delete event callback
		$(document).on("swipeleft swiperight", ".list_elem", function (event) {
				var itemID = $(this).attr('id');
				var itemsList = JSON.parse(localStorage.getItem('itemsList'));
				var instanceID = itemsList[itemID].instanceID;
				$("#confirm").popup("open");
				$("#confirm #yes").on("click", function () {
					
					//if item is in secure storage remove secureStorage object.
					var item = itemsList[itemID];
					if (isItemSecured(item)) {
						intel.security.secureStorage.delete(null, fail, { 'id': itemID });
						if (instanceID !== unavailableItem)
						{
							intel.security.secureData.destroy(null, fail, instanceID);
						}
					}
					removeItemFromListView(itemID);												
					delete itemsList[itemID];
					localStorage.setItem('itemsList', JSON.stringify(itemsList));
					$("#confirm #yes").off();
				});			
				$("#confirm #cancel").on("click", function () {
					$("#confirm #cancel").off();
				});
    	});
    }
	
    /**************************************************************************/
    //clear the new item form from user data
    /**************************************************************************/
    function clearNewItemPage() {
        $('#new_item_text').val('');
        $('#new_item_text').textinput('refresh');
        $('#new_item_id').val('');
        $('#new_item_tag').val('');
        $('#secure_item').val('on').slider("refresh");
		$('#new_item_id').parent().css('border-color','');
		$('#new_item_id').parent().css('border-color','');
		$('#new_item_text').css('border-color','');
    }    

    $(function () {
        document.addEventListener("deviceready", onDeviceReady, false);
    });

    /*********************************************************************************************/
    //function loads default items, so when the app loads for the first time it is not empty.
    /*********************************************************************************************/
    function loadDefaultItems() {
        createNewUnsecureItem('Social_media', 'password private', '12345678');
        createNewUnsecureItem('e-mail', 'password private', 'this is my email password');
        createNewUnsecureItem('Bank', 'password private', 'abcdef');
        convertImgToBase64('images/photo-01.jpg', function (base64Img) {
            createNewUnsecureItem('Camping', 'image public', base64Img);
        });
        convertImgToBase64('images/photo-02.jpg', function (base64Img) {
            createNewUnsecureItem('Kids_1', 'image private', base64Img);
        });
        convertImgToBase64('images/photo-03.jpg', function (base64Img) {
            createNewUnsecureItem('Kids_2', 'image private', base64Img);
        });
        convertImgToBase64('images/photo-04.jpg', function (base64Img) {
			createNewUnsecureItem('My_tablet', 'image public', base64Img);
        });
    }
	
    /*********************************************************************************************/
    //filter function implementation, if item is to be filtered out a true value will be returned. 
    /*********************************************************************************************/
    $.mobile.document.one("filterablecreate", "#items_list", function () {
        $("#items_list").filterable("option", "filterCallback", function (index, searchValue) {
            if (searchValue === "") {
                return false;
            }
            var searchTags = searchValue.toLowerCase().split(" ");
            var elementTags = $(this).find('p').contents().text().toLowerCase().split(" ");
			var searchTagsFound  = searchTags.every(function(val) { return elementTags.indexOf(val) >= 0; });
			if (searchTagsFound === true)
			{
				return false; //show item
			}
			return true; //filter item out
        });
    });
	

	//test if url is a vaild image
    function isValidImageUrl(url, success, failure) { 
        $("<img>", {
            src: url,
            error: failure,
            load: success
        });
    }
	
    function convertImgToBase64(url, callback) {
        var canvas = document.createElement('CANVAS');
        var ctx = canvas.getContext('2d');
        var img = new Image();
        img.onload = function () {
            canvas.height = img.height;
            canvas.width = img.width;
            ctx.drawImage(img, 0, 0);
            var dataURL = canvas.toDataURL('image/png');
            callback.call(this, dataURL);
            canvas = null;
        };
        img.src = url;
    }
	
    function isItemSecured(item) {
        //if item has an instanceID associated with a secureData object then item is secured
        if (item.instanceID !== itemNotSecured) {
            return true;
        }
        return false;
    }
	
    $(document).ready(register_event_handlers);
})();